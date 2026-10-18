/**
 * 本站静态资源下载：流式读取汇报进度，存入 Cache Storage（第二次打开不走网络）。
 * 所有模型和 wasm 都放在本站 public/ 下，不依赖任何海外 CDN。
 */
import sizes from './assetSizes.json';

const CACHE = 'lingjing-assets-v1';

export function assetUrl(path: string) {
  return new URL(import.meta.env.BASE_URL + path, document.baseURI).href;
}

export function expectedSize(path: string): number {
  return (sizes as Record<string, number>)[path] ?? 0;
}

async function openCache(): Promise<Cache | null> {
  try {
    if (typeof caches === 'undefined') return null;
    return await caches.open(CACHE);
  } catch {
    return null;
  }
}

const memo = new Map<string, Promise<Uint8Array>>();

/** 下载 public 下的文件；onBytes 报告已下载字节数 */
export function fetchAsset(path: string, onBytes?: (n: number) => void): Promise<Uint8Array> {
  const hit = memo.get(path);
  if (hit) {
    hit.then((b) => onBytes?.(b.length)).catch(() => {});
    return hit;
  }
  const p = (async () => {
    const url = assetUrl(path);
    const cache = await openCache();
    const want = expectedSize(path);
    if (cache) {
      try {
        const r = await cache.match(url);
        if (r) {
          const b = new Uint8Array(await r.arrayBuffer());
          if (!want || b.length === want) {
            onBytes?.(b.length);
            return b;
          }
        }
      } catch {
        /* ignore */
      }
    }
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { cache: attempt ? 'reload' : 'default' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let buf: Uint8Array;
        if (res.body && 'getReader' in res.body) {
          const reader = res.body.getReader();
          const chunks: Uint8Array[] = [];
          let n = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            n += value.length;
            onBytes?.(n);
          }
          buf = new Uint8Array(n);
          let o = 0;
          for (const c of chunks) {
            buf.set(c, o);
            o += c.length;
          }
        } else {
          buf = new Uint8Array(await res.arrayBuffer());
          onBytes?.(buf.length);
        }
        if (want && buf.length !== want) throw new Error(`文件不完整 ${buf.length}/${want}`);
        if (cache) cache.put(url, new Response(buf.slice().buffer)).catch(() => {});
        return buf;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
    throw lastErr;
  })();
  memo.set(path, p);
  p.catch(() => memo.delete(path));
  return p;
}

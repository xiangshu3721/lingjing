/** 场景常用小工具：高清 2D 画布、按钮、数学 */
import type { SceneContext } from './types';

export interface Canvas2D {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dpr: number;
  w: number;
  h: number;
  resize(w: number, h: number): void;
  clear(): void;
  dispose(): void;
}

export function maxDpr() {
  return Math.min(window.devicePixelRatio || 1, 2);
}

export function canvas2d(parent: HTMLElement, w: number, h: number, dprCap = maxDpr()): Canvas2D {
  const canvas = document.createElement('canvas');
  canvas.className = 'layer';
  parent.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  const c: Canvas2D = {
    canvas,
    ctx,
    dpr: dprCap,
    w,
    h,
    resize(nw, nh) {
      c.w = nw;
      c.h = nh;
      canvas.width = Math.round(nw * c.dpr);
      canvas.height = Math.round(nh * c.dpr);
      canvas.style.width = nw + 'px';
      canvas.style.height = nh + 'px';
      ctx.setTransform(c.dpr, 0, 0, c.dpr, 0, 0);
    },
    clear() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(c.dpr, 0, 0, c.dpr, 0, 0);
    },
    dispose() {
      canvas.width = canvas.height = 0;
      canvas.remove();
    },
  };
  c.resize(w, h);
  return c;
}

export function button(ctx: SceneContext, label: string, onClick: () => void, opts: { title?: string; cls?: string } = {}) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip ' + (opts.cls ?? '');
  b.textContent = label;
  if (opts.title) b.setAttribute('aria-label', opts.title);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    ctx.audio.unlock();
    onClick();
  });
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  ctx.ui.appendChild(b);
  return b;
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** 在舞台上方飘出的文字 */
export interface FloatText {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
  size: number;
}

export function drawFloatTexts(g: CanvasRenderingContext2D, list: FloatText[], dt: number) {
  for (let i = list.length - 1; i >= 0; i--) {
    const f = list[i];
    f.life -= dt;
    f.y -= 50 * dt;
    if (f.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    g.save();
    g.globalAlpha = Math.min(1, f.life * 1.5);
    g.font = `600 ${f.size}px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`;
    g.textAlign = 'center';
    g.fillStyle = f.color;
    g.shadowColor = f.color;
    g.shadowBlur = 12;
    g.fillText(f.text, f.x, f.y);
    g.restore();
  }
}

export function loadNumber(key: string, def = 0) {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v ? v : def;
  } catch {
    return def;
  }
}
export function saveNumber(key: string, v: number) {
  try {
    localStorage.setItem(key, String(v));
  } catch {
    /* ignore */
  }
}

export const FONT = 'system-ui, -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
export const SERIF = '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", "SimSun", serif';

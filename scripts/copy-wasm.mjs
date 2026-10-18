// 从 npm 包 @mediapipe/tasks-vision 拷贝 wasm 到 public/wasm，运行时不依赖任何海外 CDN。
// 同时检查 public/models 下三个模型都在（模型文件已提交进仓库）。
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const dst = join(root, 'public/wasm');
const files = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm'];
mkdirSync(dst, { recursive: true });
for (const f of files) {
  const from = join(src, f);
  if (!existsSync(from)) {
    console.error(`[copy-wasm] 找不到 ${from}，请先 npm install`);
    process.exit(1);
  }
  const to = join(dst, f);
  if (existsSync(to) && statSync(to).size === statSync(from).size) continue;
  copyFileSync(from, to);
  console.log(`[copy-wasm] ${f}`);
}
const models = ['hand_landmarker.task', 'face_landmarker.task', 'pose_landmarker_lite.task'];
const sizes = {};
for (const m of models) {
  const p = join(root, 'public/models', m);
  if (!existsSync(p)) {
    console.error(`[copy-wasm] 缺少 public/models/${m}`);
    process.exit(1);
  }
  sizes[`models/${m}`] = statSync(p).size;
}
for (const f of files) sizes[`wasm/${f}`] = statSync(join(dst, f)).size;
const out = join(root, 'src/engine/assetSizes.json');
writeFileSync(out, JSON.stringify(sizes, null, 2) + '\n');

import type { Pt } from '../src/engine/types';

/**
 * 生成一只竖直向上的合成手（归一化坐标，aspect=1）。
 * ext: [拇指, 食指, 中指, 无名指, 小指] 是否伸直；pinch=true 时拇指尖与食指尖贴合。
 */
export function makeHand(opts: { ext?: boolean[]; pinch?: boolean; cx?: number; cy?: number; s?: number; flat?: boolean } = {}): Pt[] {
  const { ext = [true, true, true, true, true], pinch = false, cx = 0.5, cy = 0.75, s = 0.1, flat = true } = opts;
  const lm: Pt[] = new Array(21).fill(0).map(() => ({ x: 0, y: 0, z: 0 }));
  const zf = flat ? 0 : 1; // 侧着的手：x 方向压扁成 z
  const P = (x: number, y: number): Pt => ({ x: cx + x * s * (flat ? 1 : 0.15), y: cy + y * s, z: x * s * zf });
  lm[0] = P(0, 0);
  // 四指根部 x 位置
  const bases = [-0.32, 0, 0.3, 0.55];
  const ids = [
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20],
  ];
  ids.forEach((f, k) => {
    const bx = bases[k];
    lm[f[0]] = P(bx, -1);
    if (ext[k + 1]) {
      lm[f[1]] = P(bx, -1.4);
      lm[f[2]] = P(bx, -1.7);
      lm[f[3]] = P(bx, -2.0);
    } else {
      // 弯曲：指尖回到掌心附近
      lm[f[1]] = P(bx, -1.3);
      lm[f[2]] = P(bx, -1.05);
      lm[f[3]] = P(bx, -0.85);
    }
  });
  // 拇指
  lm[1] = P(-0.35, -0.2);
  lm[2] = P(-0.65, -0.4);
  if (ext[0]) {
    lm[3] = P(-0.95, -0.55);
    lm[4] = P(-1.2, -0.65);
  } else {
    lm[3] = P(-0.55, -0.7);
    lm[4] = P(-0.35, -0.85);
  }
  if (pinch) {
    lm[4] = { ...lm[8] };
    lm[4].x += 0.01 * s;
  }
  return lm;
}

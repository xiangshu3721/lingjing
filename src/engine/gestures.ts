/**
 * 手势识别（纯函数，便于单元测试）。
 * 输入为 MediaPipe 的 21 个归一化关键点（x 按视频宽、y 按视频高归一化），aspect = 视频宽/高。
 * 所有距离按「手掌大小」（手腕 0 → 中指根 9）归一化，与远近无关。
 */
import type { GestureName, Pt } from './types';

export const LM = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_TIP: 20,
} as const;

export const GESTURE_CFG = {
  pinchEnter: 0.28,
  pinchExit: 0.42,
  /** 捏合时食指尖到手腕距离 / 手掌 的下限（区分握拳） */
  pinchMinReach: 1.1,
  /** 指尖到手腕距离 / 指节到手腕距离 大于它 → 手指伸直 */
  extendRatio: 1.18,
  /** 拇指尖到食指根距离 / 手掌 大于它 → 拇指张开 */
  thumbOut: 0.62,
  /** L 手势：拇指与食指方向夹角下限（度） */
  lMinAngle: 50,
  /** 掌心正对镜头：法向量 z 分量占比 */
  flatNormal: 0.72,
};

type L = ArrayLike<Pt>;

export function dist(a: Pt, b: Pt, aspect = 1) {
  return Math.hypot((a.x - b.x) * aspect, a.y - b.y);
}

export function palmSize(lm: L, aspect = 1) {
  return dist(lm[LM.WRIST], lm[LM.MIDDLE_MCP], aspect);
}

export function pinchRatio(lm: L, aspect = 1) {
  const p = palmSize(lm, aspect);
  if (p <= 1e-6) return Infinity;
  return dist(lm[LM.THUMB_TIP], lm[LM.INDEX_TIP], aspect) / p;
}

const FINGERS: [number, number][] = [
  [LM.INDEX_PIP, LM.INDEX_TIP],
  [LM.MIDDLE_PIP, LM.MIDDLE_TIP],
  [LM.RING_PIP, LM.RING_TIP],
  [LM.PINKY_PIP, LM.PINKY_TIP],
];

/** 四指是否伸直 [食指, 中指, 无名指, 小指] */
export function fingersExtended(lm: L, aspect = 1): boolean[] {
  const w = lm[LM.WRIST];
  return FINGERS.map(([pip, tip]) => dist(w, lm[tip], aspect) > dist(w, lm[pip], aspect) * GESTURE_CFG.extendRatio);
}

export function thumbExtended(lm: L, aspect = 1) {
  const p = palmSize(lm, aspect);
  return dist(lm[LM.THUMB_TIP], lm[LM.INDEX_MCP], aspect) / p > GESTURE_CFG.thumbOut;
}

/** 两个向量夹角（度） */
export function angleBetween(ax: number, ay: number, bx: number, by: number) {
  const d = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (d < 1e-9) return 0;
  const c = Math.min(1, Math.max(-1, (ax * bx + ay * by) / d));
  return (Math.acos(c) * 180) / Math.PI;
}

export function isLShape(lm: L, aspect = 1) {
  const [i, m, r, p] = fingersExtended(lm, aspect);
  if (!i || m || r || p) return false;
  if (!thumbExtended(lm, aspect)) return false;
  const t = lm[LM.THUMB_TIP], tb = lm[LM.THUMB_MCP];
  const it = lm[LM.INDEX_TIP], ib = lm[LM.INDEX_MCP];
  const ang = angleBetween((t.x - tb.x) * aspect, t.y - tb.y, (it.x - ib.x) * aspect, it.y - ib.y);
  return ang >= GESTURE_CFG.lMinAngle;
}

/** 掌心是否平摊正对镜头（用 3D 法向量；需要 z） */
export function isPalmFlat(lm: L) {
  const w = lm[LM.WRIST], a = lm[LM.INDEX_MCP], b = lm[LM.PINKY_MCP];
  const ax = a.x - w.x, ay = a.y - w.y, az = (a.z ?? 0) - (w.z ?? 0);
  const bx = b.x - w.x, by = b.y - w.y, bz = (b.z ?? 0) - (w.z ?? 0);
  const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
  const n = Math.hypot(nx, ny, nz);
  if (n < 1e-9) return false;
  return Math.abs(nz) / n > GESTURE_CFG.flatNormal;
}

/** 手腕→中指根 相对竖直向上的角度（弧度，屏幕坐标，顺时针为正） */
export function handRoll(lm: L, aspect = 1) {
  const w = lm[LM.WRIST], m = lm[LM.MIDDLE_MCP];
  return Math.atan2((m.x - w.x) * aspect, -(m.y - w.y));
}

export interface Classified {
  gesture: GestureName;
  pinching: boolean;
  pinchRatio: number;
}

/** 识别手势；wasPinching 用于捏合的滞回（进入/退出阈值不同，防抖） */
export function classifyHand(lm: L, aspect = 1, wasPinching = false): Classified {
  const pr = pinchRatio(lm, aspect);
  // 握拳时拇指也会碰到食指，所以要求食指尖离手腕足够远（没有缩进掌心）
  const reach = dist(lm[LM.WRIST], lm[LM.INDEX_TIP], aspect) / Math.max(palmSize(lm, aspect), 1e-6);
  const pinching = reach > GESTURE_CFG.pinchMinReach && (wasPinching ? pr < GESTURE_CFG.pinchExit : pr < GESTURE_CFG.pinchEnter);
  const ext = fingersExtended(lm, aspect);
  const n = ext.filter(Boolean).length;
  const thumb = thumbExtended(lm, aspect);
  let gesture: GestureName = 'none';
  if (pinching) gesture = 'pinch';
  else if (n >= 4 || (n === 3 && thumb && !ext[3])) gesture = 'open';
  else if (n === 0) gesture = 'fist';
  else if (ext[0] && n === 1) gesture = isLShape(lm, aspect) ? 'L' : 'point';
  else if (ext[0] && ext[1] && n === 2) gesture = 'victory';
  return { gesture, pinching: gesture === 'pinch', pinchRatio: pr };
}

/** 横向挥手检测（输入为舞台像素坐标） */
export class SwipeDetector {
  private hist: { x: number; y: number; t: number }[] = [];
  private coolUntil = 0;
  constructor(
    public minDistRatio = 0.22,
    public windowMs = 450,
    public cooldownMs = 650,
  ) {}
  reset() {
    this.hist = [];
  }
  /** 返回 'left' | 'right' | null（屏幕方向） */
  push(x: number, y: number, t: number, width: number): 'left' | 'right' | null {
    this.hist.push({ x, y, t });
    while (this.hist.length && t - this.hist[0].t > this.windowMs) this.hist.shift();
    if (t < this.coolUntil || this.hist.length < 3) return null;
    const a = this.hist[0];
    const dx = x - a.x, dy = y - a.y;
    if (Math.abs(dx) > width * this.minDistRatio && Math.abs(dx) > Math.abs(dy) * 1.6) {
      this.coolUntil = t + this.cooldownMs;
      this.hist = [];
      return dx > 0 ? 'right' : 'left';
    }
    return null;
  }
}

/** 下劈 / 点头检测：短时间内向下移动足够距离后再停住或回弹 */
export class ChopDetector {
  private hist: { y: number; t: number }[] = [];
  private coolUntil = 0;
  constructor(
    public minDist = 60,
    public windowMs = 260,
    public cooldownMs = 280,
  ) {}
  reset() {
    this.hist = [];
  }
  push(y: number, t: number): boolean {
    this.hist.push({ y, t });
    while (this.hist.length && t - this.hist[0].t > this.windowMs) this.hist.shift();
    if (t < this.coolUntil || this.hist.length < 3) return false;
    let minY = Infinity;
    for (const h of this.hist) minY = Math.min(minY, h.y);
    const n = this.hist.length;
    const last = this.hist[n - 1], prev = this.hist[n - 2];
    // 已下行 minDist，且最新一帧不再明显下行（到底了）
    if (last.y - minY > this.minDist && last.y - prev.y < this.minDist * 0.25) {
      this.coolUntil = t + this.cooldownMs;
      this.hist = [];
      return true;
    }
    return false;
  }
}

/** 按手腕位置把新一帧的手和旧 id 对应起来（最近邻贪心） */
export function matchIds(prev: { id: number; x: number; y: number }[], next: { x: number; y: number }[], maxDist: number, nextId: () => number): number[] {
  const ids: number[] = new Array(next.length).fill(-1);
  const used = new Set<number>();
  const pairs: { i: number; j: number; d: number }[] = [];
  next.forEach((n, i) => prev.forEach((p, j) => pairs.push({ i, j, d: Math.hypot(n.x - p.x, n.y - p.y) })));
  pairs.sort((a, b) => a.d - b.d);
  for (const { i, j, d } of pairs) {
    if (d > maxDist || ids[i] !== -1 || used.has(j)) continue;
    ids[i] = prev[j].id;
    used.add(j);
  }
  for (let i = 0; i < ids.length; i++) if (ids[i] === -1) ids[i] = nextId();
  return ids;
}

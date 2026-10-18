/**
 * 毛笔笔锋（纯计算）。
 * 起笔细、走得慢则中锋饱、走得快则收细并带飞白；松手时沿行笔方向收到尖。
 */

export type InkTone = 0 | 1;

export interface StrokePoint {
  x: number;
  y: number;
  /** 笔锋半径（像素） */
  w: number;
  /** 0 湿润 … 1 飞白 */
  dry: number;
}

export interface Stroke {
  tone: InkTone;
  pts: StrokePoint[];
}

export interface RadiusInput {
  /** 笔尖速度，像素/秒 */
  speed: number;
  /** 拇指尖到食指尖 / 掌宽。越小捏得越紧。触屏时用速度，不看这个值。 */
  pinchRatio: number;
  source: 'camera' | 'touch';
  /** 这一笔已经走出的距离（像素） */
  traveled: number;
  /** 基准半径，随屏幕短边变化 */
  base: number;
}

export function brushBase(width: number, height: number) {
  return clamp(Math.min(width, height) * 0.016, 4.2, 12);
}

/** 这一帧的笔锋粗细与干湿 */
export function brushRadius(input: RadiusInput): { w: number; dry: number } {
  const speedN = clamp(input.speed / 1500, 0, 1);
  const speedMul = lerp(1.2, 0.28, smooth(speedN));
  let force = 0.9;
  if (input.source === 'camera') {
    const tight = clamp(1 - input.pinchRatio / 0.45, 0, 1);
    force = lerp(0.46, 1.24, tight);
  }
  const open = clamp(input.traveled / Math.max(12, input.base * 4.2), 0, 1);
  const head = lerp(0.18, 1, smooth(open));
  const dry = clamp((input.speed - 560) / 1100, 0, 1);
  const w = clamp(input.base * speedMul * force * head, 0.55, input.base * 2.5);
  return { w, dry };
}

/** 收笔：沿末段方向把笔锋收到尖。顿点只轻轻提一下，不拉出长尾。 */
export function withTail(pts: StrokePoint[], base: number): StrokePoint[] {
  if (!pts.length) return [];
  const out = pts.map((p) => ({ ...p }));
  const last = out[out.length - 1];
  const traveled = pathLength(out);
  if (out.length < 2 || traveled < Math.max(8, base * 1.05)) {
    out.push({
      x: last.x,
      y: last.y - Math.max(1.6, last.w * 0.42),
      w: Math.max(0.35, last.w * 0.16),
      dry: Math.min(1, last.dry + 0.12),
    });
    return out;
  }
  const prev = out[Math.max(0, out.length - 4)];
  let dx = last.x - prev.x;
  let dy = last.y - prev.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  const tail = Math.max(last.w * 1.15, 3.5) * (1 + last.dry * 2);
  const n = 7;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    out.push({
      x: last.x + dx * tail * t,
      y: last.y + dy * tail * t,
      w: Math.max(0.3, last.w * (1 - t * t)),
      dry: Math.min(1, last.dry + t * 0.4),
    });
  }
  return out;
}

export function pathLength(pts: { x: number; y: number }[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return d;
}

/** 手一下子跳太远就断笔，避免一笔拉过整张纸 */
export function isJump(prev: { x: number; y: number }, next: { x: number; y: number }, span: number) {
  return Math.hypot(next.x - prev.x, next.y - prev.y) > span;
}

export interface SavedDoc {
  v: 1;
  w: number;
  h: number;
  strokes: Stroke[];
}

const MAX_STROKES = 80;
const MAX_JSON = 1_200_000;

export function packDoc(doc: SavedDoc): string | null {
  let strokes = doc.strokes.slice(-MAX_STROKES).map(slimStroke);
  let json = JSON.stringify({ v: 1 as const, w: Math.round(doc.w), h: Math.round(doc.h), strokes });
  while (json.length > MAX_JSON && strokes.length > 1) {
    strokes = strokes.slice(1);
    json = JSON.stringify({ v: 1 as const, w: Math.round(doc.w), h: Math.round(doc.h), strokes });
  }
  if (json.length > MAX_JSON || !(doc.w > 0) || !(doc.h > 0)) return null;
  return json;
}

export function unpackDoc(raw: string | null): SavedDoc | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<SavedDoc>;
    if (!o || o.v !== 1 || !Array.isArray(o.strokes) || !(typeof o.w === 'number' && o.w > 0) || !(typeof o.h === 'number' && o.h > 0)) return null;
    const strokes: Stroke[] = [];
    for (const s of o.strokes) {
      if (!s || (s.tone !== 0 && s.tone !== 1) || !Array.isArray(s.pts)) continue;
      const pts: StrokePoint[] = [];
      for (const p of s.pts) {
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.w)) continue;
        pts.push({ x: p.x, y: p.y, w: Math.max(0.2, p.w), dry: clamp(Number(p.dry) || 0, 0, 1) });
      }
      if (pts.length) strokes.push({ tone: s.tone, pts });
    }
    return { v: 1, w: o.w, h: o.h, strokes };
  } catch {
    return null;
  }
}

/** 按保存时的画布尺寸缩放到现在的纸上 */
export function scaleStrokes(doc: SavedDoc, w: number, h: number): Stroke[] {
  const sx = w / doc.w;
  const sy = h / doc.h;
  const sw = (sx + sy) / 2;
  return doc.strokes.map((s) => ({
    tone: s.tone,
    pts: s.pts.map((p) => ({ x: p.x * sx, y: p.y * sy, w: Math.max(0.2, p.w * sw), dry: p.dry })),
  }));
}

function slimStroke(s: Stroke): Stroke {
  if (s.pts.length <= 240) return { tone: s.tone, pts: s.pts.map(roundPt) };
  const step = Math.ceil(s.pts.length / 240);
  const pts: StrokePoint[] = [];
  for (let i = 0; i < s.pts.length; i += step) pts.push(roundPt(s.pts[i]));
  const tail = roundPt(s.pts[s.pts.length - 1]);
  const prev = pts[pts.length - 1];
  if (Math.hypot(tail.x - prev.x, tail.y - prev.y) > 0.4) pts.push(tail);
  return { tone: s.tone, pts };
}

function roundPt(p: StrokePoint): StrokePoint {
  return {
    x: Math.round(p.x * 10) / 10,
    y: Math.round(p.y * 10) / 10,
    w: Math.round(p.w * 10) / 10,
    dry: Math.round(p.dry * 100) / 100,
  };
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}
function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

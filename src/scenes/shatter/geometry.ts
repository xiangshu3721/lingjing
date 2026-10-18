/** 把屏幕矩形按裂痕切成许多凸多边形碎片（纯函数，可测试） */
export type Poly = { x: number; y: number }[];

/** 用直线 (p, dir) 把凸多边形切成两半；不相交返回 null */
export function splitPoly(poly: Poly, px: number, py: number, dx: number, dy: number): [Poly, Poly] | null {
  const side = (q: { x: number; y: number }) => (q.x - px) * dy - (q.y - py) * dx;
  const a: Poly = [];
  const b: Poly = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    const sp = side(p);
    const sq = side(q);
    if (sp >= 0) a.push(p);
    if (sp <= 0) b.push(p);
    if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) {
      const t = sp / (sp - sq);
      const m = { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
      a.push(m);
      b.push(m);
    }
  }
  if (a.length < 3 || b.length < 3) return null;
  if (polyArea(a) < 1 || polyArea(b) < 1) return null;
  return [a, b];
}

export function polyArea(p: Poly) {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

export function centroid(p: Poly) {
  let x = 0, y = 0;
  for (const q of p) {
    x += q.x;
    y += q.y;
  }
  return { x: x / p.length, y: y / p.length };
}

/**
 * 生成碎片：每个裂痕点附近放几条随机方向的切线，只切离该点较近的碎片，
 * 所以裂痕附近碎得细、远处是大块。maxShards 控制上限（手机上少一些）。
 */
export function shatter(w: number, h: number, crack: { x: number; y: number }[], maxShards = 160, rnd: () => number = Math.random): Poly[] {
  let polys: Poly[] = [
    [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ],
  ];
  const diag = Math.hypot(w, h);
  const anchors: { x: number; y: number; r: number }[] = [];
  const step = Math.max(1, Math.floor(crack.length / 14));
  for (let i = 0; i < crack.length; i += step) anchors.push({ ...crack[i], r: diag * 0.28 });
  if (crack.length) anchors.push({ ...crack[crack.length - 1], r: diag * 0.28 });
  // 一些全局的大切线，让远处也裂开
  for (let i = 0; i < 6; i++) anchors.push({ x: rnd() * w, y: rnd() * h, r: diag });
  let guard = 0;
  for (let round = 0; round < 3; round++) {
    for (const an of anchors) {
      const lines = round === 0 ? 3 : 1;
      for (let l = 0; l < lines; l++) {
        if (polys.length >= maxShards || guard++ > 4000) return polys;
        const ang = rnd() * Math.PI;
        const dx = Math.cos(ang), dy = Math.sin(ang);
        const next: Poly[] = [];
        for (const p of polys) {
          const c = centroid(p);
          if (Math.hypot(c.x - an.x, c.y - an.y) > an.r * (1 - round * 0.25) || polys.length + next.length > maxShards * 1.2) {
            next.push(p);
            continue;
          }
          const s = splitPoly(p, an.x, an.y, dx, dy);
          if (s) next.push(s[0], s[1]);
          else next.push(p);
        }
        polys = next;
      }
    }
  }
  return polys;
}

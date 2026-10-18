import { describe, expect, it } from 'vitest';
import { brushBase, brushRadius, isJump, packDoc, pathLength, scaleStrokes, unpackDoc, withTail, type Stroke } from '../src/scenes/calligraphy/brush';

const base = { speed: 80, pinchRatio: 0.05, source: 'camera' as const, traveled: 80, base: 8 };

describe('毛笔笔锋', () => {
  it('走得慢、捏得紧，比飞快的松手更粗', () => {
    const thick = brushRadius({ ...base, speed: 40, pinchRatio: 0.02 });
    const thin = brushRadius({ ...base, speed: 1400, pinchRatio: 0.4 });
    expect(thick.w).toBeGreaterThan(thin.w * 1.8);
    expect(thin.dry).toBeGreaterThan(thick.dry);
  });

  it('起笔比走出一段之后细', () => {
    const start = brushRadius({ ...base, traveled: 0, speed: 80 });
    const mid = brushRadius({ ...base, traveled: 80, speed: 80 });
    expect(start.w).toBeLessThan(mid.w * 0.55);
  });

  it('触屏只靠速度变粗细', () => {
    const slow = brushRadius({ ...base, source: 'touch', speed: 30, pinchRatio: 0 });
    const fast = brushRadius({ ...base, source: 'touch', speed: 1500, pinchRatio: 0 });
    expect(slow.w).toBeGreaterThan(fast.w);
    expect(brushBase(390, 844)).toBeGreaterThan(4);
    expect(brushBase(1400, 900)).toBeLessThanOrEqual(12);
  });

  it('收笔收到尖，顿点不拉长尾', () => {
    const body: Stroke['pts'] = [];
    for (let i = 0; i < 12; i++) body.push({ x: i * 8, y: 40, w: 6, dry: 0.1 });
    const tailed = withTail(body, 8);
    expect(tailed[tailed.length - 1].w).toBeLessThan(2);
    expect(pathLength(tailed)).toBeGreaterThan(pathLength(body));
    const dot = withTail([{ x: 10, y: 10, w: 5, dry: 0 }], 8);
    expect(dot).toHaveLength(2);
    expect(dot[1].w).toBeLessThan(dot[0].w);
    expect(Math.hypot(dot[1].x - dot[0].x, dot[1].y - dot[0].y)).toBeLessThan(8);
  });

  it('跳得太远就断笔', () => {
    expect(isJump({ x: 0, y: 0 }, { x: 30, y: 0 }, 80)).toBe(false);
    expect(isJump({ x: 0, y: 0 }, { x: 200, y: 0 }, 80)).toBe(true);
  });
});

describe('书法本地存档', () => {
  const stroke: Stroke = {
    tone: 1,
    pts: [
      { x: 1.26, y: 2, w: 3.24, dry: 0.2 },
      { x: 10, y: 4, w: 5, dry: 0.5 },
    ],
  };

  it('存了还能按新纸尺寸读回来', () => {
    const json = packDoc({ v: 1, w: 200, h: 400, strokes: [stroke] });
    expect(json).toBeTruthy();
    const doc = unpackDoc(json);
    expect(doc?.strokes[0].tone).toBe(1);
    expect(doc?.strokes[0].pts[0].x).toBeCloseTo(1.3, 1);
    const scaled = scaleStrokes(doc!, 400, 800);
    expect(scaled[0].pts[1].x).toBeCloseTo(20, 1);
    expect(scaled[0].pts[1].y).toBeCloseTo(8, 1);
    expect(scaled[0].pts[1].w).toBeGreaterThan(9);
  });

  it('坏数据直接丢掉', () => {
    expect(unpackDoc(null)).toBeNull();
    expect(unpackDoc('{')).toBeNull();
    expect(unpackDoc('{"v":2,"w":1,"h":1,"strokes":[]}')).toBeNull();
    expect(unpackDoc('{"v":1,"w":0,"h":10,"strokes":[]}')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { ChopDetector, SwipeDetector, classifyHand, isLShape, isPalmFlat, matchIds, pinchRatio, handRoll } from '../src/engine/gestures';
import { makeHand } from './handFixtures';

describe('手势识别', () => {
  it('张开手掌 → open', () => {
    expect(classifyHand(makeHand()).gesture).toBe('open');
  });
  it('握拳 → fist', () => {
    expect(classifyHand(makeHand({ ext: [false, false, false, false, false] })).gesture).toBe('fist');
  });
  it('捏合 → pinch，且比例很小', () => {
    const h = makeHand({ ext: [true, true, false, false, false], pinch: true });
    expect(pinchRatio(h)).toBeLessThan(0.1);
    expect(classifyHand(h).gesture).toBe('pinch');
  });
  it('只伸食指 → point', () => {
    expect(classifyHand(makeHand({ ext: [false, true, false, false, false] })).gesture).toBe('point');
  });
  it('拇指 + 食指成直角 → L', () => {
    const h = makeHand({ ext: [true, true, false, false, false] });
    expect(isLShape(h)).toBe(true);
    expect(classifyHand(h).gesture).toBe('L');
  });
  it('剪刀手 → victory', () => {
    expect(classifyHand(makeHand({ ext: [false, true, true, false, false] })).gesture).toBe('victory');
  });
  it('捏合滞回：中间距离时，保持原状态', () => {
    const h = makeHand({ ext: [true, true, false, false, false] });
    // 把拇指尖放到 食指尖附近，比例约 0.35（介于进入 0.28 和退出 0.42 之间）
    h[4] = { x: h[8].x - 0.035, y: h[8].y, z: 0 };
    const r = pinchRatio(h);
    expect(r).toBeGreaterThan(0.28);
    expect(r).toBeLessThan(0.42);
    expect(classifyHand(h, 1, false).pinching).toBe(false);
    expect(classifyHand(h, 1, true).pinching).toBe(true);
  });
  it('远近不影响识别（尺度不变）', () => {
    expect(classifyHand(makeHand({ s: 0.04 })).gesture).toBe('open');
    expect(classifyHand(makeHand({ s: 0.25, pinch: true, ext: [true, true, false, false, false] })).gesture).toBe('pinch');
  });
  it('掌心平摊 vs 侧掌', () => {
    expect(isPalmFlat(makeHand({ flat: true }))).toBe(true);
    expect(isPalmFlat(makeHand({ flat: false }))).toBe(false);
  });
  it('手的倾斜角：竖直为 0', () => {
    expect(Math.abs(handRoll(makeHand()))).toBeLessThan(1e-6);
  });
});

describe('挥手 / 下劈检测', () => {
  it('快速向右挥 → right，冷却期内不重复', () => {
    const s = new SwipeDetector();
    let r: string | null = null;
    for (let i = 0; i <= 6; i++) r = s.push(100 + i * 40, 300, i * 40, 800) ?? r;
    expect(r).toBe('right');
    expect(s.push(400, 300, 300, 800)).toBe(null);
  });
  it('慢慢移动不算挥手', () => {
    const s = new SwipeDetector();
    let r: string | null = null;
    for (let i = 0; i < 40; i++) r = s.push(100 + i * 5, 300, i * 50, 800) ?? r;
    expect(r).toBe(null);
  });
  it('竖直移动不算横向挥手', () => {
    const s = new SwipeDetector();
    let r: string | null = null;
    for (let i = 0; i < 8; i++) r = s.push(100 + i * 10, 100 + i * 60, i * 30, 800) ?? r;
    expect(r).toBe(null);
  });
  it('下劈：快速下移后停住 → 触发一次', () => {
    const c = new ChopDetector(60);
    const ys = [100, 100, 130, 170, 210, 212, 212, 212];
    const hits = ys.map((y, i) => c.push(y, i * 33)).filter(Boolean).length;
    expect(hits).toBe(1);
  });
  it('缓慢下移不触发', () => {
    const c = new ChopDetector(60);
    let hits = 0;
    for (let i = 0; i < 60; i++) if (c.push(100 + i * 2, i * 33)) hits++;
    expect(hits).toBe(0);
  });
});

describe('手的 id 匹配', () => {
  it('按最近距离保留 id，新手分配新 id', () => {
    let n = 10;
    const ids = matchIds(
      [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 100, y: 0 },
      ],
      [
        { x: 98, y: 3 },
        { x: 500, y: 500 },
      ],
      80,
      () => n++,
    );
    expect(ids).toEqual([2, 10]);
  });
});

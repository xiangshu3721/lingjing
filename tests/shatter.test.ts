import { describe, expect, it } from 'vitest';
import { polyArea, shatter, splitPoly } from '../src/scenes/shatter/geometry';

describe('碎屏切片', () => {
  it('切一刀：面积守恒', () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const r = splitPoly(sq, 5, 5, 1, 1)!;
    expect(r).not.toBeNull();
    expect(polyArea(r[0]) + polyArea(r[1])).toBeCloseTo(100);
  });
  it('不相交返回 null', () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(splitPoly(sq, 50, 50, 1, 0)).toBeNull();
  });
  it('整屏碎片面积之和 = 屏幕面积，数量不超上限', () => {
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const crack = Array.from({ length: 30 }, (_, i) => ({ x: 100 + i * 10, y: 300 + Math.sin(i) * 30 }));
    const ps = shatter(390, 844, crack, 120, rnd);
    expect(ps.length).toBeGreaterThan(30);
    expect(ps.length).toBeLessThanOrEqual(150);
    const sum = ps.reduce((s, p) => s + polyArea(p), 0);
    expect(sum).toBeCloseTo(390 * 844, -1);
  });
});

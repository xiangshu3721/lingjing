import { describe, expect, it } from 'vitest';
import { computeCover, coverUv, mapPoint } from '../src/engine/mapping';

describe('坐标映射', () => {
  it('镜像：视频左侧的点显示在屏幕右侧', () => {
    const m = computeCover(640, 480, 640, 480, true);
    expect(mapPoint(0.1, 0.5, m).x).toBeCloseTo(576);
    const n = computeCover(640, 480, 640, 480, false);
    expect(mapPoint(0.1, 0.5, n).x).toBeCloseTo(64);
  });
  it('竖屏手机 cover 裁切：中心对中心，上下撑满', () => {
    const m = computeCover(640, 480, 390, 844, true);
    const c = mapPoint(0.5, 0.5, m);
    expect(c.x).toBeCloseTo(195);
    expect(c.y).toBeCloseTo(422);
    expect(mapPoint(0.5, 0, m).y).toBeCloseTo(0);
    expect(mapPoint(0.5, 1, m).y).toBeCloseTo(844);
  });
  it('coverUv 与 mapPoint 一致', () => {
    const m = computeCover(640, 480, 390, 844, true);
    const u = coverUv(m);
    // 视频点 (0.3, 0.6) 映射到屏幕后，再用 uv 公式换回来应一致
    const p = mapPoint(0.3, 0.6, m);
    const sx = p.x / 390, sy = p.y / 844;
    expect(sx * u.rx + u.ox).toBeCloseTo(0.3);
    expect(sy * u.ry + u.oy).toBeCloseTo(0.6);
  });
});

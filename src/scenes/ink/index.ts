/**
 * 水墨 · 以身作画：捏合是毛笔（越慢越粗，墨会晕开）；张开手快挥是泼墨；
 * 身体（手腕、脚踝）会留下流动的彩色留痕。
 */
import type { InputFrame } from '../../engine/types';
import { button, canvas2d, clamp, dist, rand } from '../kit';
import type { SceneContext, SceneInstance } from '../types';

const INKS = [
  { name: '墨', rgb: [22, 20, 18] },
  { name: '朱砂', rgb: [184, 40, 36] },
  { name: '石青', rgb: [38, 92, 140] },
  { name: '藤黄', rgb: [222, 168, 40] },
  { name: '金', rgb: [216, 180, 106] },
];

export function create(ctx: SceneContext): SceneInstance {
  let w = ctx.width, h = ctx.height;
  // 画纸（持久）+ 效果层（每帧清）
  const paper = canvas2d(ctx.root, w, h, Math.min(1.5, window.devicePixelRatio || 1));
  const fxl = canvas2d(ctx.root, w, h);
  fxl.canvas.dataset.nophoto = '1';
  let night = false;
  let ink = 0;
  let bodyTrail = true;
  const last = new Map<number, { x: number; y: number; wd: number }>();
  const poseLast = new Map<number, { x: number; y: number }>();
  let lastSplash = 0;
  let time = 0;

  const fillPaper = () => {
    const g = paper.ctx;
    paper.clear();
    if (night) {
      g.fillStyle = 'rgba(8,10,14,0.88)';
      g.fillRect(0, 0, w, h);
    } else {
      g.fillStyle = 'rgba(240,232,214,0.93)';
      g.fillRect(0, 0, w, h);
      // 纸纹
      g.fillStyle = 'rgba(120,100,70,0.05)';
      for (let i = 0; i < 400; i++) g.fillRect(rand(0, w), rand(0, h), rand(1, 3), rand(0.5, 1.2));
    }
  };
  fillPaper();

  const colorOf = (a: number) => {
    const c = INKS[ink].rgb;
    if (night && ink === 0) return `rgba(235,230,220,${a})`;
    return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  };

  const inkBtn = button(ctx, `色：${INKS[0].name}`, () => {
    ink = (ink + 1) % INKS.length;
    inkBtn.textContent = `色：${INKS[ink].name}`;
  });
  button(ctx, '换纸', () => {
    night = !night;
    fillPaper();
  });
  const bodyBtn = button(ctx, '身体留痕', () => {
    bodyTrail = !bodyTrail;
    bodyBtn.classList.toggle('on', bodyTrail);
  });
  bodyBtn.classList.add('on');
  button(ctx, '清空', fillPaper);

  const stamp = (x: number, y: number, r: number, a: number) => {
    const g = paper.ctx;
    // 墨晕：几层半透明圆
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.arc(x + rand(-r * 0.25, r * 0.25), y + rand(-r * 0.25, r * 0.25), r * (1 + k * 0.5), 0, Math.PI * 2);
      g.fillStyle = colorOf(a * (k === 0 ? 0.9 : 0.12));
      g.fill();
    }
  };

  const strokeSeg = (a: { x: number; y: number }, b: { x: number; y: number }, wa: number, wb: number) => {
    const g = paper.ctx;
    const d = dist(a, b);
    const n = Math.max(1, Math.ceil(d / 2.5));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      const r = (wa + (wb - wa) * t) / 2;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fillStyle = colorOf(0.55);
      g.fill();
      // 飞白：边缘的细丝
      if (Math.random() < 0.25) {
        g.beginPath();
        g.arc(x + rand(-r, r), y + rand(-r, r), r * 0.18, 0, Math.PI * 2);
        g.fillStyle = colorOf(0.35);
        g.fill();
      }
    }
  };

  const splash = (x: number, y: number, vx: number, vy: number) => {
    const sp = Math.hypot(vx, vy) || 1;
    const dx = vx / sp, dy = vy / sp;
    stamp(x, y, rand(10, 18), 0.6);
    for (let i = 0; i < 26; i++) {
      const t = rand(0.2, 1.6);
      const px = x + dx * t * 90 + rand(-30, 30);
      const py = y + dy * t * 90 + rand(-30, 30);
      stamp(px, py, rand(1.5, 7) * (1.6 - t * 0.6), rand(0.4, 0.8));
    }
    ctx.audio.noiseHit({ gain: 0.15, decay: 0.2, freq: 900, type: 'lowpass' });
  };

  return {
    update(f: InputFrame) {
      const dt = f.dt;
      time += dt;
      const seen = new Set<number>();
      for (const hd of f.hands) {
        seen.add(hd.id);
        const p = hd.source === 'camera' ? hd.tip : hd.pinchPt;
        if (hd.pinching) {
          const sp = Math.hypot(hd.vel.x, hd.vel.y);
          const wd = clamp(26 - sp / 45, 3, 26) * (hd.source === 'touch' ? 0.8 : 1);
          const prev = last.get(hd.id);
          if (prev) {
            const sw = prev.wd + (wd - prev.wd) * 0.25;
            if (dist(prev, p) < Math.max(w, h) * 0.2) strokeSeg(prev, p, prev.wd, sw);
            last.set(hd.id, { x: p.x, y: p.y, wd: sw });
          } else {
            stamp(p.x, p.y, wd * 0.6, 0.7);
            last.set(hd.id, { x: p.x, y: p.y, wd });
          }
        } else {
          const prev = last.get(hd.id);
          if (prev) stamp(prev.x, prev.y, prev.wd * 0.3, 0.4); // 收笔
          last.delete(hd.id);
          if (hd.source === 'camera' && hd.gesture === 'open' && Math.hypot(hd.vel.x, hd.vel.y) > 900 && time - lastSplash > 0.35) {
            lastSplash = time;
            splash(hd.palm.x, hd.palm.y, hd.vel.x, hd.vel.y);
          }
        }
      }
      for (const id of [...last.keys()]) if (!seen.has(id)) last.delete(id);

      // 身体留痕：手腕 15/16、脚踝 27/28、鼻子 0
      fxl.clear();
      if (f.pose && bodyTrail) {
        const g = paper.ctx;
        const cols = { 15: '95,227,176', 16: '255,95,162', 27: '216,180,106', 28: '140,180,255', 0: '236,231,220' } as Record<number, string>;
        for (const k of [15, 16, 27, 28, 0]) {
          const p = f.pose.lm[k];
          if (!p || p.v < 0.5) {
            poseLast.delete(k);
            continue;
          }
          const prev = poseLast.get(k);
          if (prev && dist(prev, p) < Math.max(w, h) * 0.15) {
            g.beginPath();
            g.moveTo(prev.x, prev.y);
            g.lineTo(p.x, p.y);
            g.strokeStyle = `rgba(${cols[k]},${night ? 0.5 : 0.35})`;
            g.lineWidth = k === 0 ? 1.5 : 4;
            g.lineCap = 'round';
            g.stroke();
          }
          poseLast.set(k, { x: p.x, y: p.y });
          const fg = fxl.ctx;
          fg.beginPath();
          fg.arc(p.x, p.y, 6, 0, Math.PI * 2);
          fg.fillStyle = `rgba(${cols[k]},0.8)`;
          fg.fill();
        }
      }
      // 笔尖提示
      const fg = fxl.ctx;
      for (const hd of f.hands) {
        const p = hd.source === 'camera' ? hd.tip : hd.pinchPt;
        fg.beginPath();
        fg.arc(p.x, p.y, hd.pinching ? 4 : 10, 0, Math.PI * 2);
        fg.strokeStyle = colorOf(0.8);
        fg.lineWidth = 1.5;
        fg.stroke();
      }
    },
    resize(nw, nh) {
      // 保留已画内容
      const old = document.createElement('canvas');
      old.width = paper.canvas.width;
      old.height = paper.canvas.height;
      old.getContext('2d')!.drawImage(paper.canvas, 0, 0);
      w = nw;
      h = nh;
      paper.resize(w, h);
      fxl.resize(w, h);
      fillPaper();
      paper.ctx.drawImage(old, 0, 0, w, h);
    },
    dispose() {
      paper.dispose();
      fxl.dispose();
    },
  };
}

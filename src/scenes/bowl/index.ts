/**
 * 颂钵：手指沿钵口画圈 → 持续的「嗡——」；捏合/点击钵身 → 敲一声。水面随声波荡漾。
 */
import type { InputFrame } from '../../engine/types';
import { ChopDetector } from '../../engine/gestures';
import { button, canvas2d, clamp, FONT, SERIF } from '../kit';
import type { SceneContext, SceneInstance } from '../types';

const BOWLS = [
  { name: '低', freq: 130.8 },
  { name: '中', freq: 196 },
  { name: '高', freq: 261.6 },
];

export function create(ctx: SceneContext): SceneInstance {
  let w = ctx.width, h = ctx.height;
  const c = canvas2d(ctx.root, w, h);
  let bi = 1;
  let rub: ReturnType<typeof ctx.audio.rubVoice> = null;
  let rubLevel = 0;
  let energy = 0; // 声音能量，驱动水波与光
  const rings: { r: number; a: number }[] = [];
  const trail: { x: number; y: number; a: number }[] = [];
  let lastAng: number | null = null;
  let omega = 0;
  let time = 0;
  let strikes = 0;
  const chops = new Map<number, ChopDetector>();

  const btns = BOWLS.map((b, i) =>
    button(ctx, `${b.name}音钵`, () => {
      bi = i;
      btns.forEach((x, k) => x.classList.toggle('on', k === i));
      rub?.stop();
      rub = null;
      strike(0.6);
    }),
  );
  btns[bi].classList.add('on');

  const geo = () => {
    const R = Math.min(w, h * 0.8) * 0.3;
    return { cx: w / 2, cy: h * 0.52, R };
  };

  const strike = (s = 1) => {
    ctx.audio.bowl(BOWLS[bi].freq, s);
    energy = Math.min(1.5, energy + 0.8 * s);
    rings.push({ r: 0, a: 1 });
    strikes++;
  };

  return {
    update(f: InputFrame) {
      const dt = f.dt;
      time += dt;
      const { cx, cy, R } = geo();
      // ---- 输入：敲击 ----
      for (const s of f.pinchStarted) {
        const d = Math.hypot(s.pinchPt.x - cx, (s.pinchPt.y - cy) * 1.6);
        if (d < R * 1.3) strike(s.source === 'touch' ? 1 : 0.9);
      }
      for (const hd of f.hands) {
        if (hd.source !== 'camera') continue;
        let cd = chops.get(hd.id);
        if (!cd) chops.set(hd.id, (cd = new ChopDetector(h * 0.08, 260, 450)));
        if (cd.push(hd.palm.y, f.t) && Math.abs(hd.palm.x - cx) < R * 1.4) strike(0.8);
      }
      // ---- 输入：沿钵口画圈（食指尖/按住的手指） ----
      const rubber = f.hands.find((hd) => {
        const p = hd.source === 'camera' ? hd.tip : hd.pinching ? hd.pinchPt : null;
        if (!p) return false;
        const d = Math.hypot(p.x - cx, (p.y - cy) * 1.6);
        return d > R * 0.55 && d < R * 1.5 && (hd.source === 'touch' || hd.gesture === 'point' || hd.gesture === 'open' || hd.gesture === 'pinch' || hd.gesture === 'victory');
      });
      if (rubber) {
        const p = rubber.source === 'camera' ? rubber.tip : rubber.pinchPt;
        const ang = Math.atan2((p.y - cy) * 1.6, p.x - cx);
        if (lastAng !== null) {
          let da = ang - lastAng;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          omega = omega * 0.85 + (da / Math.max(dt, 1 / 120)) * 0.15;
        }
        lastAng = ang;
        trail.push({ x: cx + Math.cos(ang) * R, y: cy + (Math.sin(ang) * R) / 1.6, a: 1 });
      } else {
        lastAng = null;
        omega *= 0.9;
      }
      const target = clamp((Math.abs(omega) - 1.2) / 6, 0, 1);
      rubLevel += (target - rubLevel) * Math.min(1, dt * 3);
      if (rubLevel > 0.02 && !rub && ctx.audio.ready) rub = ctx.audio.rubVoice(BOWLS[bi].freq);
      rub?.set(rubLevel);
      energy = Math.max(rubLevel * 0.8, energy - dt * 0.18);

      // ---- 绘制 ----
      c.clear();
      const g = c.ctx;
      // 暗色晕染背景
      const bg = g.createRadialGradient(cx, cy, R * 0.3, cx, cy, Math.max(w, h) * 0.8);
      bg.addColorStop(0, `rgba(40,30,18,${0.55 + energy * 0.1})`);
      bg.addColorStop(1, 'rgba(5,6,8,0.85)');
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      // 呼吸引导光圈
      const breath = (Math.sin(time * ((Math.PI * 2) / 10)) + 1) / 2;
      g.beginPath();
      g.ellipse(cx, cy + R * 0.15, R * (1.55 + breath * 0.25), (R * (1.55 + breath * 0.25)) / 1.6, 0, 0, Math.PI * 2);
      g.strokeStyle = `rgba(216,180,106,${0.08 + breath * 0.1})`;
      g.lineWidth = 1;
      g.stroke();
      g.font = `14px ${SERIF}`;
      g.fillStyle = `rgba(216,180,106,${0.35 + breath * 0.3})`;
      g.textAlign = 'center';
      g.fillText(breath > 0.5 ? '吸 ——' : '呼 ——', cx, cy - R * 1.25);
      // 钵身（侧面）
      const body = g.createLinearGradient(cx - R, 0, cx + R, 0);
      body.addColorStop(0, '#3a2510');
      body.addColorStop(0.35, '#b8873e');
      body.addColorStop(0.55, '#f0cf88');
      body.addColorStop(0.75, '#9c6a2a');
      body.addColorStop(1, '#2e1c0c');
      g.beginPath();
      g.moveTo(cx - R, cy);
      g.bezierCurveTo(cx - R, cy + R * 0.9, cx + R, cy + R * 0.9, cx + R, cy);
      g.closePath();
      g.fillStyle = body;
      g.shadowColor = `rgba(240,200,120,${0.25 + energy * 0.4})`;
      g.shadowBlur = 30 + energy * 40;
      g.fill();
      g.shadowBlur = 0;
      // 钵身纹饰
      g.strokeStyle = 'rgba(60,35,10,0.5)';
      g.lineWidth = 1.2;
      for (let k = 1; k <= 2; k++) {
        g.beginPath();
        g.ellipse(cx, cy + R * 0.12 * k, R * (1 - 0.05 * k), (R / 1.6) * (1 - 0.05 * k) * 0.35, 0, 0, Math.PI);
        g.stroke();
      }
      // 钵口
      g.beginPath();
      g.ellipse(cx, cy, R, R / 1.6, 0, 0, Math.PI * 2);
      const rim = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      rim.addColorStop(0, '#f6dc9c');
      rim.addColorStop(0.5, '#8a5b22');
      rim.addColorStop(1, '#f0cf88');
      g.strokeStyle = rim;
      g.lineWidth = R * 0.07;
      g.stroke();
      // 水面
      g.save();
      g.beginPath();
      g.ellipse(cx, cy, R * 0.93, (R * 0.93) / 1.6, 0, 0, Math.PI * 2);
      g.clip();
      const water = g.createRadialGradient(cx, cy, 0, cx, cy, R);
      water.addColorStop(0, '#1c3a36');
      water.addColorStop(1, '#0a1614');
      g.fillStyle = water;
      g.fillRect(cx - R, cy - R, R * 2, R * 2);
      // 驻波纹（能量越大越密越亮）
      const n = 7;
      for (let k = 1; k <= n; k++) {
        const rr = (k / n) * R * 0.93 + Math.sin(time * 22 + k) * energy * 3;
        g.beginPath();
        g.ellipse(cx, cy, rr, rr / 1.6, 0, 0, Math.PI * 2);
        g.strokeStyle = `rgba(150,240,210,${0.05 + energy * 0.22 * (0.5 + 0.5 * Math.sin(time * 30 + k * 1.3))})`;
        g.lineWidth = 1.2;
        g.stroke();
      }
      // 敲击扩散波
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.r += dt * R * 0.6;
        r.a -= dt * 0.5;
        if (r.a <= 0) {
          rings.splice(i, 1);
          continue;
        }
        g.beginPath();
        g.ellipse(cx, cy, r.r, r.r / 1.6, 0, 0, Math.PI * 2);
        g.strokeStyle = `rgba(220,255,240,${r.a * 0.6})`;
        g.lineWidth = 2;
        g.stroke();
      }
      // 月影
      g.beginPath();
      g.ellipse(cx + R * 0.25 + Math.sin(time * 16) * energy * 4, cy - R * 0.1, R * 0.12, R * 0.07, 0, 0, Math.PI * 2);
      g.fillStyle = `rgba(240,220,170,${0.25 + energy * 0.2})`;
      g.fill();
      g.restore();
      // 钵口光迹
      g.globalCompositeOperation = 'lighter';
      for (let i = trail.length - 1; i >= 0; i--) {
        const t = trail[i];
        t.a -= dt * 1.5;
        if (t.a <= 0) {
          trail.splice(i, 1);
          continue;
        }
        g.beginPath();
        g.arc(t.x, t.y, 4 + t.a * 6, 0, Math.PI * 2);
        g.fillStyle = `rgba(255,214,140,${t.a * 0.5})`;
        g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      // 状态
      g.font = `500 13px ${FONT}`;
      g.fillStyle = 'rgba(236,231,220,0.7)';
      g.fillText(rubLevel > 0.1 ? `嗡 —— ${'·'.repeat(1 + Math.floor(rubLevel * 5))}` : strikes ? `已敲 ${strikes} 声` : '', cx, cy + R * 1.0);
    },
    resize(nw, nh) {
      w = nw;
      h = nh;
      c.resize(w, h);
    },
    dispose() {
      rub?.stop();
      c.dispose();
    },
  };
}

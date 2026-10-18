/**
 * 泡茶：温杯 → 投茶 → 注水 → 出汤。手拿起器具（手掌位置），把手倾斜（或捏住停在目标上方）就会倒。
 */
import type { Hand, InputFrame } from '../../engine/types';
import { button, canvas2d, clamp, FONT, rand, SERIF } from '../kit';
import type { SceneContext, SceneInstance } from '../types';

type Step = 0 | 1 | 2 | 3 | 4;
const STEPS = ['温杯', '投茶', '注水', '出汤', '品茶'];
const STEP_HINT = [
  '① 温杯：手托铁壶，移到右边小杯上方，把手倾斜倒水',
  '② 投茶：捏住茶罐里的茶叶，移到盖碗上方松开',
  '③ 注水：手托铁壶，移到盖碗上方倾斜注水',
  '④ 出汤：手托盖碗，移到小杯上方倾斜出汤',
  '请用茶 · 点「再来一泡」重新开始',
];

interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export function create(ctx: SceneContext): SceneInstance {
  let w = ctx.width, h = ctx.height;
  const c = canvas2d(ctx.root, w, h);
  let step: Step = 0;
  let cupFill = 0; // 0~1
  let cupTea = false;
  let bowlFill = 0;
  let leaves = 0; // 盖碗里的茶叶 0~1
  let emptying = 0;
  let held = { x: w * 0.3, y: h * 0.35, tilt: 0 };
  let carryingLeaf = false;
  const drops: Drop[] = [];
  const steam: { x: number; y: number; a: number; r: number }[] = [];
  let water: ReturnType<typeof ctx.audio.waterVoice> = null;
  let time = 0;
  let doneT = 0;
  let pourHold = 0;

  const resetBtn = button(ctx, '再来一泡', () => reset());
  const reset = () => {
    step = 0;
    cupFill = bowlFill = leaves = 0;
    cupTea = false;
    doneT = 0;
    ctx.setHint(STEP_HINT[0]);
  };
  void resetBtn;
  ctx.setHint(STEP_HINT[0]);

  const L = () => {
    const s = Math.min(w, h * 0.75);
    const tableY = h * 0.68;
    return {
      s,
      tableY,
      bowl: { x: w * 0.42, y: tableY, r: s * 0.13 },
      cup: { x: w * 0.75, y: tableY, r: s * 0.075 },
      jar: { x: w * 0.14, y: tableY, r: s * 0.07 },
    };
  };

  const nextStep = () => {
    step = Math.min(4, step + 1) as Step;
    ctx.audio.success();
    ctx.setHint(STEP_HINT[step]);
  };

  const drawKettle = (g: CanvasRenderingContext2D, s: number) => {
    // 铁壶：原点在壶身中心，壶嘴朝右
    g.fillStyle = '#2a2724';
    g.strokeStyle = '#6b6258';
    g.lineWidth = 1.5;
    g.beginPath();
    g.ellipse(0, 0, s * 0.11, s * 0.09, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // 壶嘴
    g.beginPath();
    g.moveTo(s * 0.08, s * 0.01);
    g.quadraticCurveTo(s * 0.16, -s * 0.0, s * 0.19, -s * 0.07);
    g.lineTo(s * 0.17, -s * 0.075);
    g.quadraticCurveTo(s * 0.14, -s * 0.02, s * 0.08, -s * 0.03);
    g.fill();
    g.stroke();
    // 提梁
    g.beginPath();
    g.arc(0, -s * 0.07, s * 0.08, Math.PI, 0);
    g.strokeStyle = '#8a7a62';
    g.lineWidth = s * 0.012;
    g.stroke();
    // 霰纹
    g.fillStyle = 'rgba(120,110,95,0.5)';
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      g.beginPath();
      g.arc(Math.cos(a) * s * 0.07, Math.sin(a) * s * 0.05, s * 0.006, 0, Math.PI * 2);
      g.fill();
    }
  };

  const drawGaiwanShape = (g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: number, tea: number, leafAmt: number, lid = true) => {
    // 碗身
    g.beginPath();
    g.moveTo(x - r, y - r * 0.6);
    g.quadraticCurveTo(x - r * 0.9, y + r * 0.2, x - r * 0.35, y + r * 0.25);
    g.lineTo(x + r * 0.35, y + r * 0.25);
    g.quadraticCurveTo(x + r * 0.9, y + r * 0.2, x + r, y - r * 0.6);
    g.closePath();
    const gr = g.createLinearGradient(x - r, 0, x + r, 0);
    gr.addColorStop(0, '#b9d4c8');
    gr.addColorStop(0.5, '#f2f7f2');
    gr.addColorStop(1, '#a9c6b8');
    g.fillStyle = gr;
    g.fill();
    // 青花纹
    g.strokeStyle = 'rgba(40,80,150,0.55)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x - r * 0.7, y - r * 0.2);
    g.bezierCurveTo(x - r * 0.3, y - r * 0.45, x, y + r * 0.05, x + r * 0.6, y - r * 0.25);
    g.stroke();
    // 碗口 + 液面
    g.beginPath();
    g.ellipse(x, y - r * 0.6, r, r * 0.22, 0, 0, Math.PI * 2);
    g.fillStyle = '#e8efe9';
    g.fill();
    if (fill > 0.02) {
      g.beginPath();
      g.ellipse(x, y - r * 0.6 + (1 - fill) * r * 0.1, r * (0.75 + 0.2 * fill), r * 0.18 * (0.75 + 0.2 * fill), 0, 0, Math.PI * 2);
      g.fillStyle = tea > 0 ? `rgba(${200 - tea * 60},${140 - tea * 50},${40},0.9)` : 'rgba(200,225,230,0.8)';
      g.fill();
    }
    if (leafAmt > 0) {
      g.fillStyle = '#4b6a2a';
      for (let i = 0; i < 16 * leafAmt; i++) {
        const a = i * 2.39;
        const rr = (0.2 + ((i * 37) % 10) / 14) * r * 0.6;
        g.beginPath();
        g.ellipse(x + Math.cos(a) * rr, y - r * 0.6 + Math.sin(a) * rr * 0.2, r * 0.07 * (1 + fill), r * 0.025, a, 0, Math.PI * 2);
        g.fill();
      }
    }
    // 托
    g.beginPath();
    g.ellipse(x, y + r * 0.28, r * 0.85, r * 0.12, 0, 0, Math.PI * 2);
    g.fillStyle = '#cfe0d6';
    g.fill();
    if (lid) {
      g.beginPath();
      g.ellipse(x + r * 1.5, y + r * 0.2, r * 0.55, r * 0.14, 0, 0, Math.PI * 2);
      g.fillStyle = '#dfe9e2';
      g.fill();
    }
  };

  const drawCup = (g: CanvasRenderingContext2D, x: number, y: number, r: number) => {
    g.beginPath();
    g.moveTo(x - r, y - r);
    g.quadraticCurveTo(x - r * 0.95, y + r * 0.3, x, y + r * 0.35);
    g.quadraticCurveTo(x + r * 0.95, y + r * 0.3, x + r, y - r);
    g.closePath();
    const gr = g.createLinearGradient(x - r, 0, x + r, 0);
    gr.addColorStop(0, '#d9c9a8');
    gr.addColorStop(0.5, '#fff8ea');
    gr.addColorStop(1, '#cdbb98');
    g.fillStyle = gr;
    g.fill();
    g.beginPath();
    g.ellipse(x, y - r, r, r * 0.25, 0, 0, Math.PI * 2);
    g.fillStyle = '#f5ecda';
    g.fill();
    const f = emptying > 0 ? cupFill * (1 - emptying) : cupFill;
    if (f > 0.02) {
      g.beginPath();
      g.ellipse(x, y - r + (1 - f) * r * 0.5, r * (0.6 + 0.35 * f), r * 0.2 * (0.6 + 0.35 * f), 0, 0, Math.PI * 2);
      g.fillStyle = cupTea ? 'rgba(176,104,34,0.95)' : 'rgba(200,225,230,0.85)';
      g.fill();
    }
  };

  const drawJar = (g: CanvasRenderingContext2D, x: number, y: number, r: number) => {
    g.fillStyle = '#5a3a26';
    g.beginPath();
    g.roundRect(x - r, y - r * 1.8, r * 2, r * 2, r * 0.35);
    g.fill();
    g.fillStyle = '#c23b2e';
    g.fillRect(x - r * 0.55, y - r * 1.4, r * 1.1, r * 1.2);
    g.fillStyle = '#f3e2b0';
    g.font = `700 ${r * 0.7}px ${SERIF}`;
    g.textAlign = 'center';
    g.fillText('茶', x, y - r * 0.55);
    g.fillStyle = '#4b6a2a';
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.ellipse(x - r * 0.6 + i * r * 0.24, y - r * 1.85, r * 0.12, r * 0.05, i, 0, Math.PI * 2);
      g.fill();
    }
  };

  const pourPoint = (x: number, y: number, tilt: number, s: number, vessel: 'kettle' | 'gaiwan') => {
    const local = vessel === 'kettle' ? { x: s * 0.19, y: -s * 0.07 } : { x: s * 0.13, y: -s * 0.08 };
    const c2 = Math.cos(tilt), s2 = Math.sin(tilt);
    return { x: x + local.x * c2 - local.y * s2, y: y + local.x * s2 + local.y * c2 };
  };

  const handTilt = (hd: Hand | undefined) => {
    if (!hd) return 0;
    if (hd.source === 'touch') return 0;
    // 手向右倾（顺时针） → 正
    return clamp(hd.roll, -1.4, 1.4);
  };

  return {
    update(f: InputFrame) {
      const dt = f.dt;
      time += dt;
      const lay = L();
      const { s } = lay;
      const hd = f.hands.find((x) => x.source === 'camera') ?? f.hands.find((x) => x.pinching) ?? f.hands[0];
      const vessel: 'kettle' | 'gaiwan' | 'leaf' | null = step === 0 || step === 2 ? 'kettle' : step === 3 ? 'gaiwan' : step === 1 ? 'leaf' : null;
      if (hd) {
        const p = hd.source === 'camera' ? hd.palm : hd.pinchPt;
        held.x += (p.x - held.x) * Math.min(1, dt * 12);
        held.y += (p.y - held.y) * Math.min(1, dt * 12);
      }
      const target = step === 0 || step === 3 ? lay.cup : lay.bowl;
      let pouring = false;
      if (vessel === 'kettle' || vessel === 'gaiwan') {
        let tilt = handTilt(hd);
        const sp = pourPoint(held.x, held.y, held.tilt, s, vessel);
        const over = Math.abs(sp.x - target.x) < target.r * 1.6 && sp.y < target.y;
        // 触屏 / 捏住停在目标上方：自动倾倒
        if (hd && (hd.source === 'touch' ? hd.pinching : hd.pinching || hd.gesture === 'fist') && over) pourHold = Math.min(1, pourHold + dt * 2.5);
        else pourHold = Math.max(0, pourHold - dt * 3);
        tilt = Math.max(tilt, pourHold * 0.9);
        held.tilt += (tilt - held.tilt) * Math.min(1, dt * 8);
        pouring = held.tilt > 0.5 && !!hd;
        if (pouring) {
          const sp2 = pourPoint(held.x, held.y, held.tilt, s, vessel);
          const flow = clamp((held.tilt - 0.5) * 2, 0.3, 1);
          for (let i = 0; i < 3; i++)
            drops.push({ x: sp2.x + rand(-2, 2), y: sp2.y, vx: 60 + flow * 80 + rand(-10, 10), vy: rand(0, 30), life: 1.2, color: vessel === 'gaiwan' ? '#c27a2c' : '#d7eef5' });
          const hitTarget = Math.abs(sp2.x + 40 - target.x) < target.r * 1.4 && sp2.y < target.y;
          if (hitTarget) {
            const rate = dt * 0.28 * flow;
            if (step === 0) cupFill = Math.min(1, cupFill + rate);
            if (step === 2) bowlFill = Math.min(1, bowlFill + rate * 0.8);
            if (step === 3) {
              cupTea = true;
              cupFill = Math.min(1, cupFill + rate);
              bowlFill = Math.max(0, bowlFill - rate * 0.8);
            }
          }
        }
      } else {
        held.tilt += (0 - held.tilt) * Math.min(1, dt * 8);
      }
      // 投茶：捏住茶罐 → 带着茶叶 → 到盖碗上方松开
      if (step === 1) {
        for (const p of f.pinchStarted) if (Math.hypot(p.pinchPt.x - lay.jar.x, p.pinchPt.y - (lay.jar.y - lay.jar.r)) < lay.jar.r * 2.2) {
          carryingLeaf = true;
          ctx.audio.pop(300);
        }
        for (const p of f.pinchEnded) {
          if (carryingLeaf) {
            carryingLeaf = false;
            if (Math.abs(p.pinchPt.x - lay.bowl.x) < lay.bowl.r * 1.6 && p.pinchPt.y < lay.bowl.y + 20) {
              for (let i = 0; i < 14; i++) drops.push({ x: p.pinchPt.x + rand(-8, 8), y: p.pinchPt.y, vx: rand(-20, 20), vy: rand(0, 40), life: 1, color: '#4b6a2a' });
              leaves = 1;
              ctx.audio.noiseHit({ gain: 0.12, decay: 0.25, freq: 3000 });
              setTimeout(() => step === 1 && nextStep(), 500);
            } else ctx.toast('要放到盖碗上方再松开');
          }
        }
      }
      // 进度判断
      if (step === 0 && cupFill >= 0.6 && emptying === 0) {
        emptying = 0.001;
      }
      if (emptying > 0) {
        emptying += dt / 0.9;
        if (emptying >= 1) {
          emptying = 0;
          cupFill = 0;
          nextStep();
        }
      }
      if (step === 2 && bowlFill >= 0.85) nextStep();
      if (step === 3 && cupFill >= 0.8) nextStep();
      if (step === 4) {
        doneT += dt;
        if (Math.random() < dt * 8) steam.push({ x: lay.cup.x + rand(-lay.cup.r * 0.5, lay.cup.r * 0.5), y: lay.cup.y - lay.cup.r, a: 0.5, r: rand(6, 12) });
      }
      if (step === 2 || step === 3) if (Math.random() < dt * 4) steam.push({ x: lay.bowl.x + rand(-lay.bowl.r * 0.5, lay.bowl.r * 0.5), y: lay.bowl.y - lay.bowl.r * 0.6, a: 0.35, r: rand(8, 14) });
      // 水声
      if (pouring && !water && ctx.audio.ready) water = ctx.audio.waterVoice();
      water?.set(pouring ? 0.9 : 0, vessel === 'gaiwan' ? 0.3 : 0.6);

      // ---- 绘制 ----
      c.clear();
      const g = c.ctx;
      g.fillStyle = 'rgba(10,8,6,0.55)';
      g.fillRect(0, 0, w, h);
      // 茶席
      const tb = g.createLinearGradient(0, lay.tableY - s * 0.05, 0, h);
      tb.addColorStop(0, '#3b2414');
      tb.addColorStop(1, '#1a0f08');
      g.fillStyle = tb;
      g.fillRect(0, lay.tableY + s * 0.02, w, h);
      g.fillStyle = 'rgba(216,180,106,0.15)';
      g.fillRect(w * 0.05, lay.tableY + s * 0.05, w * 0.9, 2);
      // 步骤条
      g.textAlign = 'center';
      const sw = Math.min(70, (w - 40) / 5);
      for (let i = 0; i < 5; i++) {
        const x = w / 2 + (i - 2) * sw;
        const y = 92;
        g.beginPath();
        g.arc(x, y, 14, 0, Math.PI * 2);
        g.fillStyle = i < step ? '#5fe3b0' : i === step ? '#d8b46a' : 'rgba(255,255,255,0.1)';
        g.fill();
        g.font = `600 12px ${FONT}`;
        g.fillStyle = i <= step ? '#111' : '#aaa';
        g.fillText(String(i + 1), x, y + 4);
        g.font = `12px ${FONT}`;
        g.fillStyle = i === step ? '#f3e2b0' : 'rgba(236,231,220,0.55)';
        g.fillText(STEPS[i], x, y + 32);
      }
      drawJar(g, lay.jar.x, lay.jar.y, lay.jar.r);
      if (step !== 3) drawGaiwanShape(g, lay.bowl.x, lay.bowl.y, lay.bowl.r, bowlFill, leaves && bowlFill > 0.1 ? 1 : 0, leaves);
      drawCup(g, lay.cup.x, lay.cup.y, lay.cup.r);
      // 手里的器具
      if (vessel === 'kettle') {
        g.save();
        g.translate(held.x, held.y);
        g.rotate(held.tilt);
        drawKettle(g, s);
        g.restore();
      } else if (vessel === 'gaiwan') {
        g.save();
        g.translate(held.x, held.y);
        g.rotate(held.tilt);
        drawGaiwanShape(g, 0, 0, lay.bowl.r * 0.9, bowlFill, 1, leaves, false);
        g.restore();
      } else if (vessel === 'leaf' && carryingLeaf && hd) {
        g.fillStyle = '#4b6a2a';
        for (let i = 0; i < 7; i++) {
          g.beginPath();
          g.ellipse(hd.pinchPt.x + Math.cos(i * 2.4) * 8, hd.pinchPt.y + 10 + Math.sin(i * 2.4) * 5, 6, 2.5, i, 0, Math.PI * 2);
          g.fill();
        }
      }
      // 水滴
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.vy += 900 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.life -= dt;
        if (d.life <= 0 || d.y > lay.tableY) {
          drops.splice(i, 1);
          continue;
        }
        g.beginPath();
        g.arc(d.x, d.y, 2.6, 0, Math.PI * 2);
        g.fillStyle = d.color;
        g.fill();
      }
      // 蒸汽
      for (let i = steam.length - 1; i >= 0; i--) {
        const p = steam[i];
        p.y -= 28 * dt;
        p.x += Math.sin(time * 2 + i) * 10 * dt;
        p.r += 8 * dt;
        p.a -= 0.2 * dt;
        if (p.a <= 0) {
          steam.splice(i, 1);
          continue;
        }
        g.beginPath();
        g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        g.fillStyle = `rgba(240,240,235,${p.a * 0.35})`;
        g.fill();
      }
      if (step === 4) {
        g.font = `700 ${Math.min(42, w * 0.1)}px ${SERIF}`;
        g.fillStyle = `rgba(243,226,176,${Math.min(1, doneT)})`;
        g.shadowColor = '#d8b46a';
        g.shadowBlur = 16;
        g.fillText('请 用 茶', w / 2, h * 0.36);
        g.shadowBlur = 0;
        // 印章
        g.save();
        g.translate(w / 2 + Math.min(110, w * 0.25), h * 0.36 - 20);
        g.rotate(-0.08);
        g.strokeStyle = '#c23b2e';
        g.lineWidth = 2;
        g.strokeRect(-18, -18, 36, 36);
        g.fillStyle = '#c23b2e';
        g.font = `700 14px ${SERIF}`;
        g.fillText('茶', 0, -2);
        g.fillText('禅', 0, 14);
        g.restore();
      }
      if (vessel !== 'leaf' && !hd) {
        g.font = `13px ${FONT}`;
        g.fillStyle = 'rgba(236,231,220,0.7)';
        g.fillText('把手举到镜头前拿起器具', w / 2, h * 0.5);
      }
    },
    resize(nw, nh) {
      w = nw;
      h = nh;
      c.resize(w, h);
      held = { x: w * 0.3, y: h * 0.35, tilt: 0 };
    },
    dispose() {
      water?.stop();
      c.dispose();
    },
  };
}

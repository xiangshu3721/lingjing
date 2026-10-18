/**
 * 敲木鱼：手往下一劈 / 点一下头 / 点屏幕 → 「笃」，功德 +1。
 */
import type { InputFrame } from '../../engine/types';
import { ChopDetector } from '../../engine/gestures';
import { button, canvas2d, drawFloatTexts, FONT, loadNumber, rand, saveNumber, SERIF, type FloatText } from '../kit';
import type { SceneContext, SceneInstance } from '../types';

const KEY = 'lingjing.merit.v1';
const WORDS = ['功德 +1', '功德 +1', '功德 +1', '烦恼 -1', '平安 +1', '好运 +1', '心静 +1', '功德 +1'];

export function create(ctx: SceneContext): SceneInstance {
  let w = ctx.width, h = ctx.height;
  const c = canvas2d(ctx.root, w, h);
  let merit = loadNumber(KEY, 0);
  let session = 0;
  const floats: FloatText[] = [];
  let hit = 0; // 敲击动画 1→0
  let auto = false;
  let autoT = 0;
  let mallet = { x: w * 0.68, y: h * 0.32 };
  const handChops = new Map<number, ChopDetector>();
  const nod = new ChopDetector(h * 0.03, 300, 380);
  let saveT = 0;

  const autoBtn = button(ctx, '自动敲', () => {
    auto = !auto;
    autoBtn.classList.toggle('on', auto);
  });
  button(ctx, '功德清零', () => {
    merit = 0;
    session = 0;
    saveNumber(KEY, 0);
    ctx.toast('重新开始积功德');
  });

  const geo = () => {
    const s = Math.min(w * 0.8, h * 0.55);
    return { cx: w / 2, cy: h * 0.56, s };
  };

  const knock = (src: string) => {
    const { cx, cy, s } = geo();
    hit = 1;
    merit++;
    session++;
    ctx.audio.woodfish(rand(0.97, 1.03));
    const word = session % 10 === 0 ? `功德圆满 ×${session}` : WORDS[Math.floor(Math.random() * WORDS.length)];
    floats.push({ x: cx + rand(-s * 0.2, s * 0.2), y: cy - s * 0.35, text: word, life: 1.2, color: session % 10 === 0 ? '#ffd36b' : '#f3e2b0', size: session % 10 === 0 ? 26 : 22 });
    if (session % 10 === 0) ctx.audio.chime(1046, 0.1);
    void src;
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      ctx.audio.unlock();
      knock('key');
    }
  };
  window.addEventListener('keydown', onKey);

  const drawFish = (g: CanvasRenderingContext2D, cx: number, cy: number, s: number, squash: number) => {
    g.save();
    g.translate(cx, cy);
    g.scale(1 + squash * 0.04, 1 - squash * 0.05);
    // 影子
    g.beginPath();
    g.ellipse(0, s * 0.33, s * 0.42, s * 0.06, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fill();
    // 坐垫
    g.beginPath();
    g.ellipse(0, s * 0.29, s * 0.45, s * 0.08, 0, 0, Math.PI * 2);
    g.fillStyle = '#7a1e1a';
    g.fill();
    // 鱼身
    const body = g.createRadialGradient(-s * 0.12, -s * 0.12, s * 0.05, 0, 0, s * 0.45);
    body.addColorStop(0, '#d8823c');
    body.addColorStop(0.55, '#9a4a1c');
    body.addColorStop(1, '#4a1f0a');
    g.beginPath();
    g.moveTo(-s * 0.4, s * 0.05);
    g.bezierCurveTo(-s * 0.42, -s * 0.3, s * 0.35, -s * 0.36, s * 0.42, 0);
    g.bezierCurveTo(s * 0.45, s * 0.22, s * 0.25, s * 0.3, 0, s * 0.3);
    g.bezierCurveTo(-s * 0.3, s * 0.3, -s * 0.4, s * 0.22, -s * 0.4, s * 0.05);
    g.fillStyle = body;
    g.shadowColor = `rgba(255,180,90,${0.2 + hit * 0.5})`;
    g.shadowBlur = 20 + hit * 30;
    g.fill();
    g.shadowBlur = 0;
    // 鱼口（开槽）
    g.beginPath();
    g.moveTo(-s * 0.3, s * 0.08);
    g.quadraticCurveTo(0, s * 0.2, s * 0.3, s * 0.06);
    g.strokeStyle = '#2a0f04';
    g.lineWidth = s * 0.035;
    g.lineCap = 'round';
    g.stroke();
    // 鱼眼
    for (const ex of [-s * 0.22, s * 0.22]) {
      g.beginPath();
      g.arc(ex, -s * 0.07, s * 0.035, 0, Math.PI * 2);
      g.fillStyle = '#2a0f04';
      g.fill();
      g.beginPath();
      g.arc(ex - s * 0.008, -s * 0.08, s * 0.01, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,230,190,0.7)';
      g.fill();
    }
    // 鳞纹
    g.strokeStyle = 'rgba(40,15,4,0.35)';
    g.lineWidth = 1.2;
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.arc(i * s * 0.08, -s * 0.2, s * 0.05, 0.2, Math.PI - 0.2);
      g.stroke();
    }
    // 高光
    g.beginPath();
    g.ellipse(-s * 0.15, -s * 0.2, s * 0.12, s * 0.04, -0.3, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,230,190,0.25)';
    g.fill();
    g.restore();
  };

  const drawMallet = (g: CanvasRenderingContext2D, x: number, y: number, angle: number, s: number) => {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.fillStyle = '#5b3418';
    g.fillRect(-s * 0.012, 0, s * 0.024, s * 0.32);
    g.beginPath();
    g.ellipse(0, 0, s * 0.05, s * 0.045, 0, 0, Math.PI * 2);
    const gr = g.createRadialGradient(-s * 0.015, -s * 0.015, 1, 0, 0, s * 0.05);
    gr.addColorStop(0, '#c98a4a');
    gr.addColorStop(1, '#5b3418');
    g.fillStyle = gr;
    g.fill();
    g.restore();
  };

  return {
    update(f: InputFrame) {
      const dt = f.dt;
      const { cx, cy, s } = geo();
      // 手下劈
      for (const hd of f.hands) {
        if (hd.source !== 'camera') continue;
        let cd = handChops.get(hd.id);
        if (!cd) handChops.set(hd.id, (cd = new ChopDetector(h * 0.07, 260, 260)));
        if (cd.push(hd.tip.y, f.t)) knock('hand');
      }
      // 点头
      if (f.face && nod.push(f.face.nose.y, f.t)) knock('nod');
      // 点屏幕
      for (const p of f.pinchStarted) if (p.source === 'touch') knock('touch');
      if (auto) {
        autoT += dt;
        if (autoT > 0.75) {
          autoT = 0;
          knock('auto');
        }
      }
      // 木槌跟随手
      const hand = f.hands.find((x) => x.source === 'camera') ?? f.hands[0];
      const rest = { x: cx + s * 0.32, y: cy - s * 0.42 };
      const tgt = hand ? { x: hand.tip.x, y: hand.tip.y } : rest;
      mallet.x += (tgt.x - mallet.x) * Math.min(1, dt * 14);
      mallet.y += (tgt.y - mallet.y) * Math.min(1, dt * 14);
      hit = Math.max(0, hit - dt * 5);
      saveT += dt;
      if (saveT > 1) {
        saveT = 0;
        saveNumber(KEY, merit);
      }

      c.clear();
      const g = c.ctx;
      const bg = g.createRadialGradient(cx, cy, s * 0.2, cx, cy, Math.max(w, h));
      bg.addColorStop(0, 'rgba(46,26,12,0.55)');
      bg.addColorStop(1, 'rgba(6,5,4,0.88)');
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      // 光圈
      g.beginPath();
      g.arc(cx, cy - s * 0.05, s * (0.55 + hit * 0.05), 0, Math.PI * 2);
      g.strokeStyle = `rgba(216,180,106,${0.12 + hit * 0.35})`;
      g.lineWidth = 1.5;
      g.stroke();
      drawFish(g, cx, cy, s, hit);
      const ang = hand ? -0.6 + hit * 0.5 : -0.9 + hit * 0.8;
      drawMallet(g, mallet.x, mallet.y + hit * s * 0.04, ang, s);
      drawFloatTexts(g, floats, dt);
      // 计数
      g.textAlign = 'center';
      g.font = `600 ${Math.min(30, w * 0.07)}px ${SERIF}`;
      g.fillStyle = '#f3e2b0';
      g.shadowColor = '#d8b46a';
      g.shadowBlur = 12;
      g.fillText(`功德 ${merit}`, cx, Math.max(110, cy - s * 0.62));
      g.shadowBlur = 0;
      g.font = `13px ${FONT}`;
      g.fillStyle = 'rgba(236,231,220,0.6)';
      g.fillText(`本次 ${session} 下`, cx, Math.max(132, cy - s * 0.62 + 22));
    },
    resize(nw, nh) {
      w = nw;
      h = nh;
      c.resize(w, h);
    },
    dispose() {
      saveNumber(KEY, merit);
      window.removeEventListener('keydown', onKey);
      c.dispose();
    },
  };
}

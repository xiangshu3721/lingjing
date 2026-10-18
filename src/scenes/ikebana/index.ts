/**
 * 中式插花：捏住下方花材 → 从瓶口「拉」出枝条（方向和高度跟着手）→ 松开就插好。
 */
import type { InputFrame } from '../../engine/types';
import { button, canvas2d, clamp, dist, FONT, SERIF } from '../kit';
import type { SceneContext, SceneInstance } from '../types';

type Kind = 'plum' | 'orchid' | 'chrys' | 'lotus' | 'bamboo' | 'pine';
const KINDS: { k: Kind; name: string }[] = [
  { k: 'plum', name: '梅' },
  { k: 'orchid', name: '兰' },
  { k: 'bamboo', name: '竹' },
  { k: 'chrys', name: '菊' },
  { k: 'lotus', name: '莲' },
  { k: 'pine', name: '松' },
];

interface Stem {
  kind: Kind;
  angle: number; // 相对竖直向上
  len: number;
  seed: number;
  sway: number;
}

function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** 在原点（瓶口）沿 -y 方向画一枝 */
function drawStem(g: CanvasRenderingContext2D, st: Stem, t: number) {
  const r = rng(st.seed);
  const L = st.len;
  g.save();
  g.rotate(st.angle + Math.sin(t * 1.2 + st.seed) * 0.015 * st.sway);
  g.lineCap = 'round';
  const bend = (r() - 0.5) * L * 0.25;
  const tip = { x: bend * 0.6, y: -L };
  const ctrl = { x: bend, y: -L * 0.5 };
  const along = (u: number) => ({
    x: 2 * (1 - u) * u * ctrl.x + u * u * tip.x,
    y: 2 * (1 - u) * u * ctrl.y + u * u * tip.y,
  });
  const branch = (color: string, width: number) => {
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(ctrl.x, ctrl.y, tip.x, tip.y);
    g.strokeStyle = color;
    g.lineWidth = width;
    g.stroke();
  };
  if (st.kind === 'plum') {
    branch('#2b1d14', 5);
    for (let i = 0; i < 4; i++) {
      const u = 0.3 + r() * 0.6;
      const p = along(u);
      const a = (r() - 0.5) * 2.2;
      const l = L * (0.15 + r() * 0.2);
      const q = { x: p.x + Math.sin(a) * l, y: p.y - Math.cos(a) * l };
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo((p.x + q.x) / 2 + (r() - 0.5) * 8, (p.y + q.y) / 2);
      g.lineTo(q.x, q.y);
      g.strokeStyle = '#2b1d14';
      g.lineWidth = 2.5;
      g.stroke();
      for (let k = 0; k < 3; k++) blossom(g, q.x + (r() - 0.5) * 16, q.y + (r() - 0.5) * 16, 5 + r() * 3, '#e8475a', '#ffd36b');
    }
    for (let k = 0; k < 5; k++) {
      const p = along(0.35 + r() * 0.65);
      blossom(g, p.x + (r() - 0.5) * 10, p.y, 4 + r() * 3, '#f06a7a', '#ffd36b');
    }
  } else if (st.kind === 'orchid') {
    for (let i = 0; i < 5; i++) {
      const a = (r() - 0.5) * 1.4;
      const l = L * (0.6 + r() * 0.45);
      g.beginPath();
      g.moveTo(0, 0);
      g.bezierCurveTo(Math.sin(a) * l * 0.3, -l * 0.5, Math.sin(a) * l * 0.9, -l * 0.8, Math.sin(a * 1.6) * l, -l * (0.7 + r() * 0.3));
      g.strokeStyle = '#2f5a35';
      g.lineWidth = 2.5;
      g.stroke();
    }
    for (let k = 0; k < 3; k++) {
      const p = along(0.7 + k * 0.1);
      g.fillStyle = '#d9c6f0';
      for (let j = 0; j < 4; j++) {
        g.beginPath();
        g.ellipse(p.x + 6, p.y, 7, 3, j * 1.4 + 0.3, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#7a3d8a';
      g.beginPath();
      g.arc(p.x + 6, p.y, 2, 0, Math.PI * 2);
      g.fill();
    }
  } else if (st.kind === 'bamboo') {
    branch('#3f7a45', 6);
    const n = Math.max(3, Math.round(L / 50));
    for (let i = 1; i < n; i++) {
      const p = along(i / n);
      g.beginPath();
      g.moveTo(p.x - 5, p.y);
      g.lineTo(p.x + 5, p.y);
      g.strokeStyle = '#2a5530';
      g.lineWidth = 2;
      g.stroke();
      if (i > n / 2) {
        for (let k = 0; k < 3; k++) {
          const a = (r() - 0.5) * 2.6;
          g.beginPath();
          g.ellipse(p.x + Math.sin(a) * 16, p.y - Math.cos(a) * 10, 15, 3.4, a + Math.PI / 2, 0, Math.PI * 2);
          g.fillStyle = '#2f6b3a';
          g.fill();
        }
      }
    }
  } else if (st.kind === 'chrys') {
    branch('#3d5a2a', 3);
    for (let k = 0; k < 3; k++) {
      const p = along(0.4 + k * 0.15);
      g.beginPath();
      g.ellipse(p.x + 8, p.y, 9, 4, 0.5, 0, Math.PI * 2);
      g.fillStyle = '#4c7a36';
      g.fill();
    }
    const R = 16 + r() * 6;
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      g.beginPath();
      g.ellipse(tip.x + Math.cos(a) * R * 0.55, tip.y + Math.sin(a) * R * 0.55, R * 0.55, 2.6, a, 0, Math.PI * 2);
      g.fillStyle = k % 2 ? '#f2b630' : '#ffd36b';
      g.fill();
    }
    g.beginPath();
    g.arc(tip.x, tip.y, 5, 0, Math.PI * 2);
    g.fillStyle = '#b8731c';
    g.fill();
  } else if (st.kind === 'lotus') {
    branch('#4f7a3a', 3.5);
    // 莲叶
    const p = along(0.55);
    g.beginPath();
    g.ellipse(p.x - 24, p.y, 26, 10, -0.3, 0, Math.PI * 2);
    g.fillStyle = '#3f7a45';
    g.fill();
    // 荷花
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.32;
      g.beginPath();
      g.ellipse(tip.x + Math.cos(a) * 10, tip.y + Math.sin(a) * 10, 13, 6, a, 0, Math.PI * 2);
      g.fillStyle = k % 2 ? '#ffc0d4' : '#ff9cbc';
      g.fill();
    }
    g.beginPath();
    g.arc(tip.x, tip.y, 4, 0, Math.PI * 2);
    g.fillStyle = '#ffd36b';
    g.fill();
  } else {
    branch('#3a2a1e', 5);
    for (let k = 0; k < 4; k++) {
      const p = along(0.45 + k * 0.17);
      const side = k % 2 ? 1 : -1;
      const q = { x: p.x + side * L * 0.18, y: p.y - 6 };
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(q.x, q.y);
      g.strokeStyle = '#3a2a1e';
      g.lineWidth = 2;
      g.stroke();
      g.beginPath();
      g.ellipse(q.x, q.y - 4, 22, 8, 0, 0, Math.PI * 2);
      g.fillStyle = 'rgba(40,90,60,0.85)';
      g.fill();
      g.strokeStyle = 'rgba(20,50,30,0.6)';
      g.lineWidth = 1;
      for (let j = -3; j <= 3; j++) {
        g.beginPath();
        g.moveTo(q.x + j * 5, q.y - 10);
        g.lineTo(q.x + j * 6, q.y + 2);
        g.stroke();
      }
    }
  }
  g.restore();
}

function blossom(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: string, c2: string) {
  g.fillStyle = c;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.beginPath();
    g.arc(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.55, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = c2;
  g.beginPath();
  g.arc(x, y, r * 0.3, 0, Math.PI * 2);
  g.fill();
}

const VASES = ['梅瓶', '玉壶春', '花觚'];

export function create(ctx: SceneContext): SceneInstance {
  let w = ctx.width, h = ctx.height;
  const c = canvas2d(ctx.root, w, h);
  const stems: Stem[] = [];
  let holding: { kind: Kind; id: number; seed: number } | null = null;
  let vase = 0;
  let time = 0;

  button(ctx, '撤销', () => stems.pop());
  button(ctx, '清空', () => (stems.length = 0));
  button(ctx, '换瓶', () => {
    vase = (vase + 1) % VASES.length;
    ctx.toast(VASES[vase]);
  });

  const L = () => {
    const s = Math.min(w, h * 0.7);
    const trayY = h - 150;
    const vaseH = s * 0.36;
    const mouth = { x: w / 2, y: trayY - 30 - vaseH };
    return { s, trayY, vaseH, mouth };
  };
  const trayItems = () => {
    const { trayY } = L();
    const gap = Math.min(64, (w - 24) / KINDS.length);
    return KINDS.map((k, i) => ({ ...k, x: w / 2 + (i - (KINDS.length - 1) / 2) * gap, y: trayY + 8, r: gap * 0.42 }));
  };

  const drawVase = (g: CanvasRenderingContext2D) => {
    const { mouth, vaseH, s } = L();
    const x = mouth.x, top = mouth.y, bot = mouth.y + vaseH;
    const W = s * 0.13;
    g.beginPath();
    if (vase === 0) {
      g.moveTo(x - W * 0.25, top);
      g.bezierCurveTo(x - W * 0.3, top + vaseH * 0.08, x - W * 1.3, top + vaseH * 0.15, x - W * 1.1, top + vaseH * 0.45);
      g.bezierCurveTo(x - W * 0.9, top + vaseH * 0.8, x - W * 0.55, bot, x - W * 0.5, bot);
      g.lineTo(x + W * 0.5, bot);
      g.bezierCurveTo(x + W * 0.55, bot, x + W * 0.9, top + vaseH * 0.8, x + W * 1.1, top + vaseH * 0.45);
      g.bezierCurveTo(x + W * 1.3, top + vaseH * 0.15, x + W * 0.3, top + vaseH * 0.08, x + W * 0.25, top);
    } else if (vase === 1) {
      g.moveTo(x - W * 0.45, top);
      g.bezierCurveTo(x - W * 0.2, top + vaseH * 0.3, x - W * 0.3, top + vaseH * 0.4, x - W * 1.15, top + vaseH * 0.75);
      g.quadraticCurveTo(x - W * 1.1, bot, x - W * 0.6, bot);
      g.lineTo(x + W * 0.6, bot);
      g.quadraticCurveTo(x + W * 1.1, bot, x + W * 1.15, top + vaseH * 0.75);
      g.bezierCurveTo(x + W * 0.3, top + vaseH * 0.4, x + W * 0.2, top + vaseH * 0.3, x + W * 0.45, top);
    } else {
      g.moveTo(x - W * 0.9, top);
      g.quadraticCurveTo(x - W * 0.3, top + vaseH * 0.35, x - W * 0.45, top + vaseH * 0.5);
      g.lineTo(x - W * 0.45, top + vaseH * 0.62);
      g.quadraticCurveTo(x - W * 0.3, top + vaseH * 0.7, x - W * 0.75, bot);
      g.lineTo(x + W * 0.75, bot);
      g.quadraticCurveTo(x + W * 0.3, top + vaseH * 0.7, x + W * 0.45, top + vaseH * 0.62);
      g.lineTo(x + W * 0.45, top + vaseH * 0.5);
      g.quadraticCurveTo(x + W * 0.3, top + vaseH * 0.35, x + W * 0.9, top);
    }
    g.closePath();
    const gr = g.createLinearGradient(x - W * 1.2, 0, x + W * 1.2, 0);
    gr.addColorStop(0, '#5f8c7c');
    gr.addColorStop(0.4, '#a9d0bf');
    gr.addColorStop(0.55, '#d8efe4');
    gr.addColorStop(1, '#4d7869');
    g.fillStyle = gr;
    g.shadowColor = 'rgba(0,0,0,0.35)';
    g.shadowBlur = 20;
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(30,50,40,0.5)';
    g.lineWidth = 1.2;
    g.stroke();
    // 冰裂纹
    g.strokeStyle = 'rgba(40,70,60,0.18)';
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      const yy = top + vaseH * (0.2 + i * 0.08);
      g.moveTo(x - W * 0.5 + ((i * 13) % 20), yy);
      g.lineTo(x + ((i * 29) % 30) - 10, yy + 12);
      g.lineTo(x + W * 0.4 - ((i * 7) % 15), yy + 5);
      g.stroke();
    }
    // 几案
    g.fillStyle = '#3a2416';
    g.fillRect(x - W * 1.8, bot, W * 3.6, 8);
  };

  return {
    update(f: InputFrame) {
      const dt = f.dt;
      time += dt;
      const { mouth, s } = L();
      const items = trayItems();
      for (const p of f.pinchStarted) {
        if (holding) break;
        const it = items.find((x) => dist(x, p.pinchPt) < x.r * 1.4);
        if (it) {
          holding = { kind: it.k, id: p.id, seed: Math.floor(Math.random() * 1e6) };
          ctx.audio.pluck(392, 0.15);
        } else {
          // 捏住已插的花枝顶端 → 拔出来重新插
          for (let i = stems.length - 1; i >= 0; i--) {
            const st = stems[i];
            const tip = { x: mouth.x + Math.sin(st.angle) * st.len, y: mouth.y - Math.cos(st.angle) * st.len };
            if (dist(tip, p.pinchPt) < 40) {
              holding = { kind: st.kind, id: p.id, seed: st.seed };
              stems.splice(i, 1);
              break;
            }
          }
        }
      }
      let preview: Stem | null = null;
      if (holding) {
        const hd = f.hands.find((x) => x.id === holding!.id && x.pinching);
        if (hd) {
          const dx = hd.pinchPt.x - mouth.x, dy = hd.pinchPt.y - mouth.y;
          const angle = clamp(Math.atan2(dx, -dy), -1.35, 1.35);
          preview = { kind: holding.kind, angle, len: clamp(Math.hypot(dx, dy), 40, s * 0.95), seed: holding.seed, sway: 0 };
        }
        const ended = f.pinchEnded.find((x) => x.id === holding!.id);
        if (ended || !hd) {
          const p = ended?.pinchPt;
          if (p && p.y < mouth.y + 10) {
            const dx = p.x - mouth.x, dy = p.y - mouth.y;
            stems.push({ kind: holding.kind, angle: clamp(Math.atan2(dx, -dy), -1.35, 1.35), len: clamp(Math.hypot(dx, dy), 40, s * 0.95), seed: holding.seed, sway: 1 });
            ctx.audio.pluck(523, 0.2);
            ctx.audio.pluck(784, 0.12, 0.08);
            if (stems.length === 5) ctx.toast('错落有致，可以拍照留念了');
          }
          holding = null;
        }
      }

      c.clear();
      const g = c.ctx;
      // 宣纸底（半透明，隐约看到自己）
      const paper = g.createLinearGradient(0, 0, 0, h);
      paper.addColorStop(0, 'rgba(239,230,212,0.9)');
      paper.addColorStop(1, 'rgba(226,214,190,0.94)');
      g.fillStyle = paper;
      g.fillRect(0, 0, w, h);
      // 远山淡墨
      g.fillStyle = 'rgba(80,90,85,0.08)';
      g.beginPath();
      g.moveTo(0, h * 0.45);
      for (let x = 0; x <= w; x += 10) g.lineTo(x, h * 0.42 + Math.sin(x * 0.01) * 30 + Math.sin(x * 0.03) * 10);
      g.lineTo(w, h);
      g.lineTo(0, h);
      g.fill();
      // 题字
      g.save();
      g.fillStyle = 'rgba(40,30,20,0.75)';
      g.font = `600 22px ${SERIF}`;
      g.textAlign = 'center';
      const title = '一瓶清供';
      for (let i = 0; i < title.length; i++) g.fillText(title[i], w - 34, 110 + i * 28);
      g.strokeStyle = '#b8322c';
      g.lineWidth = 1.5;
      g.strokeRect(w - 46, 110 + title.length * 28 - 6, 24, 24);
      g.fillStyle = '#b8322c';
      g.font = `700 12px ${SERIF}`;
      g.fillText('境', w - 34, 110 + title.length * 28 + 10);
      g.restore();
      // 花枝（先画在瓶后）
      for (const st of stems) {
        g.save();
        g.translate(mouth.x, mouth.y + 6);
        drawStem(g, st, time);
        g.restore();
      }
      if (preview) {
        g.save();
        g.globalAlpha = 0.75;
        g.translate(mouth.x, mouth.y + 6);
        drawStem(g, preview, time);
        g.restore();
      }
      drawVase(g);
      // 托盘
      const its = trayItems();
      const { trayY } = L();
      g.fillStyle = 'rgba(58,36,22,0.85)';
      g.beginPath();
      g.roundRect(its[0].x - its[0].r - 10, trayY - its[0].r - 8, its[its.length - 1].x - its[0].x + its[0].r * 2 + 20, its[0].r * 2 + 16, 14);
      g.fill();
      for (const it of its) {
        g.beginPath();
        g.arc(it.x, it.y, it.r, 0, Math.PI * 2);
        g.fillStyle = holding?.kind === it.k ? '#d8b46a' : 'rgba(239,230,212,0.92)';
        g.fill();
        g.fillStyle = '#2b1d14';
        g.font = `600 ${it.r * 0.9}px ${SERIF}`;
        g.textAlign = 'center';
        g.fillText(it.name, it.x, it.y + it.r * 0.32);
      }
      g.font = `12px ${FONT}`;
      g.fillStyle = 'rgba(40,30,20,0.6)';
      g.fillText(holding ? '往上拉，松手插入瓶中' : '捏住下方花材，往瓶口上方拉', w / 2, trayY - its[0].r - 16);
    },
    resize(nw, nh) {
      w = nw;
      h = nh;
      c.resize(w, h);
    },
    dispose() {
      c.dispose();
    },
  };
}

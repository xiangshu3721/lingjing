/**
 * AR 换装：发型 / 头饰 / 眼镜 / 面妆 / 衣领，贴在脸和肩膀上。
 * 左右歪头 = 切换当前这一类；点下方按钮也能换。没有摄像头时显示在示意人像上。
 */
import type { Face, InputFrame, Pose, Pt } from '../../engine/types';
import { button, canvas2d, FONT } from '../kit';
import type { SceneContext, SceneInstance } from '../types';

type Cat = 'hair' | 'head' | 'glasses' | 'makeup' | 'collar';
const CATS: { k: Cat; name: string; opts: string[] }[] = [
  { k: 'hair', name: '发型', opts: ['古风发髻', '齐刘海', '彩虹长发', '银白短发', '无'] },
  { k: 'head', name: '头饰', opts: ['金步摇', '斗笠', '猫耳', '花环', '无'] },
  { k: 'glasses', name: '眼镜', opts: ['圆框墨镜', '爱心眼镜', '单片金丝', '无'] },
  { k: 'makeup', name: '面妆', opts: ['花钿腮红', '狐狸半面', '脸谱', '无'] },
  { k: 'collar', name: '衣领', opts: ['朱红交领', '青碧交领', '云肩', '无'] },
];

interface Frame {
  c: Pt; // 脸中心
  roll: number;
  fw: number; // 脸宽
  fh: number;
  top: Pt;
  chin: Pt;
  eyeL: Pt;
  eyeR: Pt;
  shoulderL: Pt | null;
  shoulderR: Pt | null;
}

function faceFrame(face: Face | null, pose: Pose | null, w: number, h: number): Frame {
  if (face) {
    const lm = face.lm;
    const a = lm[33], b = lm[263];
    const [eyeL, eyeR] = a.x < b.x ? [a, b] : [b, a];
    let sl: Pt | null = null, sr: Pt | null = null;
    if (pose && pose.lm[11].v > 0.5 && pose.lm[12].v > 0.5) {
      const p = pose.lm[11], q = pose.lm[12];
      [sl, sr] = p.x < q.x ? [p, q] : [q, p];
    }
    return { c: face.center, roll: face.roll, fw: face.width, fh: face.height, top: lm[10], chin: lm[152], eyeL, eyeR, shoulderL: sl, shoulderR: sr };
  }
  // 示意人像
  const fw = Math.min(w * 0.42, h * 0.26);
  const c = { x: w / 2, y: h * 0.4 };
  return {
    c,
    roll: 0,
    fw,
    fh: fw * 1.25,
    top: { x: c.x, y: c.y - fw * 0.62 },
    chin: { x: c.x, y: c.y + fw * 0.62 },
    eyeL: { x: c.x - fw * 0.22, y: c.y - fw * 0.06 },
    eyeR: { x: c.x + fw * 0.22, y: c.y - fw * 0.06 },
    shoulderL: { x: c.x - fw * 1.0, y: c.y + fw * 1.25 },
    shoulderR: { x: c.x + fw * 1.0, y: c.y + fw * 1.25 },
  };
}

export function create(ctx: SceneContext): SceneInstance {
  let w = ctx.width, h = ctx.height;
  const c = canvas2d(ctx.root, w, h);
  const sel: Record<Cat, number> = { hair: 0, head: 0, glasses: 3, makeup: 0, collar: 0 };
  let active: Cat = 'hair';
  let tiltLock = 0;
  let time = 0;
  let flash = 0;

  const btns = CATS.map((cat) =>
    button(ctx, `${cat.name}：${cat.opts[sel[cat.k]]}`, () => {
      if (active === cat.k) sel[cat.k] = (sel[cat.k] + 1) % cat.opts.length;
      active = cat.k;
      refresh();
      ctx.audio.pop(600);
    }),
  );
  const refresh = () => {
    CATS.forEach((cat, i) => {
      btns[i].textContent = `${cat.name}：${cat.opts[sel[cat.k]]}`;
      btns[i].classList.toggle('on', cat.k === active);
    });
  };
  refresh();

  const switchActive = (dir: 1 | -1) => {
    const cat = CATS.find((x) => x.k === active)!;
    sel[active] = (sel[active] + dir + cat.opts.length) % cat.opts.length;
    refresh();
    flash = 1;
    ctx.audio.whoosh(dir > 0, 0.08);
  };

  // ---- 绘制各部件（在以脸中心为原点、已按 roll 旋转的坐标系里，单位：像素，fw = 脸宽） ----
  const hairBack = (g: CanvasRenderingContext2D, fw: number, fh: number) => {
    const v = sel.hair;
    if (v === 4) return;
    const col = v === 0 || v === 1 ? '#15110f' : v === 3 ? '#e8e6ef' : '';
    if (v === 2) {
      const gr = g.createLinearGradient(-fw, -fh * 0.6, fw, fh);
      ['#ff5fa2', '#ffb347', '#ffe066', '#5fe3b0', '#6fa8ff', '#b47cff'].forEach((cc, i) => gr.addColorStop(i / 5, cc));
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(-fw * 0.62, -fh * 0.1);
      g.quadraticCurveTo(-fw * 0.9, fh * 0.9, -fw * 0.75, fh * 1.25);
      g.lineTo(fw * 0.75, fh * 1.25);
      g.quadraticCurveTo(fw * 0.9, fh * 0.9, fw * 0.62, -fh * 0.1);
      g.closePath();
      g.globalAlpha = 0.92;
      g.fill();
      g.globalAlpha = 1;
    } else if (v === 0) {
      // 发髻在头顶
      g.fillStyle = col;
      g.beginPath();
      g.ellipse(0, -fh * 0.72, fw * 0.28, fw * 0.22, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(0, -fh * 0.88, fw * 0.17, fw * 0.14, 0, 0, Math.PI * 2);
      g.fill();
    }
    void col;
  };

  const hairFront = (g: CanvasRenderingContext2D, fw: number, fh: number) => {
    const v = sel.hair;
    if (v === 4) return;
    const col = v === 0 || v === 1 ? '#15110f' : v === 3 ? '#e8e6ef' : '';
    g.fillStyle = col;
    if (v === 2) {
      const gr = g.createLinearGradient(-fw * 0.6, 0, fw * 0.6, 0);
      ['#ff5fa2', '#ffe066', '#5fe3b0', '#6fa8ff'].forEach((cc, i) => gr.addColorStop(i / 3, cc));
      g.fillStyle = gr;
    }
    // 头顶发片
    g.beginPath();
    g.moveTo(-fw * 0.58, -fh * 0.05);
    g.bezierCurveTo(-fw * 0.66, -fh * 0.75, fw * 0.66, -fh * 0.75, fw * 0.58, -fh * 0.05);
    if (v === 1) {
      // 齐刘海
      g.lineTo(fw * 0.5, -fh * 0.22);
      g.lineTo(-fw * 0.5, -fh * 0.22);
    } else if (v === 3) {
      g.quadraticCurveTo(fw * 0.3, -fh * 0.42, -fw * 0.1, -fh * 0.3);
      g.quadraticCurveTo(-fw * 0.4, -fh * 0.25, -fw * 0.58, -fh * 0.05);
    } else {
      // 中分
      g.quadraticCurveTo(fw * 0.35, -fh * 0.45, 0, -fh * 0.42);
      g.quadraticCurveTo(-fw * 0.35, -fh * 0.45, -fw * 0.58, -fh * 0.05);
    }
    g.closePath();
    g.fill();
    if (v === 0) {
      // 发簪
      g.strokeStyle = '#d8b46a';
      g.lineWidth = Math.max(2, fw * 0.025);
      g.beginPath();
      g.moveTo(-fw * 0.4, -fh * 0.7);
      g.lineTo(fw * 0.35, -fh * 0.86);
      g.stroke();
      g.beginPath();
      g.arc(fw * 0.37, -fh * 0.865, fw * 0.035, 0, Math.PI * 2);
      g.fillStyle = '#5fe3b0';
      g.fill();
    }
    if (v === 1 || v === 3) {
      // 鬓发
      g.fillStyle = col;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(s * fw * 0.58, -fh * 0.1);
        g.quadraticCurveTo(s * fw * 0.66, fh * 0.2, s * fw * (v === 1 ? 0.55 : 0.5), fh * (v === 1 ? 0.42 : 0.15));
        g.lineTo(s * fw * 0.48, -fh * 0.05);
        g.fill();
      }
    }
  };

  const headwear = (g: CanvasRenderingContext2D, fw: number, fh: number) => {
    const v = sel.head;
    if (v === 0) {
      // 金步摇：一侧发饰 + 垂坠流苏
      const x = fw * 0.42, y = -fh * 0.6;
      g.fillStyle = '#e8c36a';
      g.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        g.lineTo(x + Math.cos(a) * fw * 0.09, y + Math.sin(a) * fw * 0.09);
        g.lineTo(x + Math.cos(a + 0.6) * fw * 0.04, y + Math.sin(a + 0.6) * fw * 0.04);
      }
      g.fill();
      g.beginPath();
      g.arc(x, y, fw * 0.03, 0, Math.PI * 2);
      g.fillStyle = '#e04a5a';
      g.fill();
      for (let k = 0; k < 3; k++) {
        const sw = Math.sin(time * 3 + k) * fw * 0.03;
        const x0 = x - fw * 0.05 + k * fw * 0.05;
        g.strokeStyle = '#e8c36a';
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(x0, y + fw * 0.05);
        g.lineTo(x0 + sw, y + fw * 0.3);
        g.stroke();
        g.beginPath();
        g.arc(x0 + sw, y + fw * 0.32, fw * 0.025, 0, Math.PI * 2);
        g.fillStyle = k === 1 ? '#5fe3b0' : '#e8c36a';
        g.fill();
      }
    } else if (v === 1) {
      // 斗笠
      g.fillStyle = '#c9a66b';
      g.beginPath();
      g.moveTo(-fw * 1.05, -fh * 0.42);
      g.lineTo(0, -fh * 1.05);
      g.lineTo(fw * 1.05, -fh * 0.42);
      g.quadraticCurveTo(0, -fh * 0.32, -fw * 1.05, -fh * 0.42);
      g.fill();
      g.strokeStyle = 'rgba(90,60,30,0.5)';
      g.lineWidth = 1;
      for (let i = -4; i <= 4; i++) {
        g.beginPath();
        g.moveTo(0, -fh * 1.05);
        g.lineTo((i / 4) * fw * 1.0, -fh * 0.4);
        g.stroke();
      }
      // 面纱
      g.fillStyle = 'rgba(240,240,240,0.18)';
      g.beginPath();
      g.moveTo(-fw * 0.95, -fh * 0.42);
      g.lineTo(-fw * 0.9, fh * 0.25);
      g.lineTo(-fw * 0.62, fh * 0.2);
      g.lineTo(-fw * 0.62, -fh * 0.38);
      g.fill();
      g.beginPath();
      g.moveTo(fw * 0.95, -fh * 0.42);
      g.lineTo(fw * 0.9, fh * 0.25);
      g.lineTo(fw * 0.62, fh * 0.2);
      g.lineTo(fw * 0.62, -fh * 0.38);
      g.fill();
    } else if (v === 2) {
      for (const s of [-1, 1]) {
        g.fillStyle = '#2a2220';
        g.beginPath();
        g.moveTo(s * fw * 0.18, -fh * 0.58);
        g.lineTo(s * fw * 0.42, -fh * 0.98);
        g.lineTo(s * fw * 0.55, -fh * 0.48);
        g.fill();
        g.fillStyle = '#ff9ccc';
        g.beginPath();
        g.moveTo(s * fw * 0.26, -fh * 0.58);
        g.lineTo(s * fw * 0.41, -fh * 0.86);
        g.lineTo(s * fw * 0.48, -fh * 0.53);
        g.fill();
      }
    } else if (v === 3) {
      const cols = ['#ff7eb6', '#ffd36b', '#ffffff', '#b47cff', '#ff9ccc'];
      for (let i = 0; i < 11; i++) {
        const a = Math.PI + (i / 10) * Math.PI;
        const x = Math.cos(a) * fw * 0.58, y = -fh * 0.32 + Math.sin(a) * fh * 0.42;
        for (let k = 0; k < 5; k++) {
          const b = (k / 5) * Math.PI * 2 + time * 0.3;
          g.beginPath();
          g.arc(x + Math.cos(b) * fw * 0.035, y + Math.sin(b) * fw * 0.035, fw * 0.032, 0, Math.PI * 2);
          g.fillStyle = cols[i % cols.length];
          g.fill();
        }
        g.beginPath();
        g.arc(x, y, fw * 0.02, 0, Math.PI * 2);
        g.fillStyle = '#ffd36b';
        g.fill();
      }
    }
  };

  const glasses = (g: CanvasRenderingContext2D, F: Frame, toLocal: (p: Pt) => Pt) => {
    const v = sel.glasses;
    if (v === 3) return;
    const l = toLocal({ x: (F.eyeL.x + F.eyeL.x) / 2, y: F.eyeL.y });
    const r = toLocal(F.eyeR);
    const cxL = l.x + F.fw * 0.06, cxR = r.x - F.fw * 0.06, cy = (l.y + r.y) / 2;
    const R = F.fw * 0.15;
    if (v === 0) {
      g.fillStyle = 'rgba(10,10,14,0.82)';
      g.strokeStyle = '#d8b46a';
      g.lineWidth = Math.max(2, F.fw * 0.018);
      for (const x of [cxL, cxR]) {
        g.beginPath();
        g.arc(x, cy, R, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.beginPath();
        g.arc(x - R * 0.35, cy - R * 0.35, R * 0.2, 0, Math.PI * 2);
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fill();
        g.fillStyle = 'rgba(10,10,14,0.82)';
      }
      g.beginPath();
      g.moveTo(cxL + R, cy);
      g.quadraticCurveTo((cxL + cxR) / 2, cy - R * 0.4, cxR - R, cy);
      g.stroke();
    } else if (v === 1) {
      for (const x of [cxL, cxR]) {
        g.save();
        g.translate(x, cy);
        g.scale(R / 16, R / 16);
        g.beginPath();
        g.moveTo(0, 12);
        g.bezierCurveTo(-22, -2, -14, -20, 0, -8);
        g.bezierCurveTo(14, -20, 22, -2, 0, 12);
        g.fillStyle = 'rgba(255,60,140,0.7)';
        g.fill();
        g.strokeStyle = '#ff9ccc';
        g.lineWidth = 2.5;
        g.stroke();
        g.restore();
      }
      g.strokeStyle = '#ff9ccc';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cxL + R, cy - R * 0.2);
      g.lineTo(cxR - R, cy - R * 0.2);
      g.stroke();
    } else {
      g.strokeStyle = '#e8c36a';
      g.lineWidth = Math.max(1.5, F.fw * 0.012);
      g.beginPath();
      g.arc(cxR, cy, R * 0.95, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(cxR, cy + R);
      g.quadraticCurveTo(cxR + R * 0.5, cy + R * 2.5, cxR + R * 1.2, cy + R * 3.2);
      g.lineWidth = 1;
      g.stroke();
    }
  };

  const makeup = (g: CanvasRenderingContext2D, F: Frame, toLocal: (p: Pt) => Pt) => {
    const v = sel.makeup;
    if (v === 3) return;
    const fw = F.fw, fh = F.fh;
    const l = toLocal(F.eyeL), r = toLocal(F.eyeR);
    if (v === 0) {
      // 花钿（额心）+ 腮红
      const top = { x: 0, y: (l.y + r.y) / 2 - fh * 0.2 };
      g.fillStyle = '#e0354a';
      for (let i = 0; i < 4; i++) {
        g.save();
        g.translate(top.x, top.y);
        g.rotate((i * Math.PI) / 2);
        g.beginPath();
        g.ellipse(0, -fw * 0.03, fw * 0.015, fw * 0.03, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      for (const p of [l, r]) {
        const gr = g.createRadialGradient(p.x, p.y + fh * 0.18, 0, p.x, p.y + fh * 0.18, fw * 0.14);
        gr.addColorStop(0, 'rgba(255,90,120,0.45)');
        gr.addColorStop(1, 'rgba(255,90,120,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(p.x, p.y + fh * 0.18, fw * 0.14, 0, Math.PI * 2);
        g.fill();
      }
    } else if (v === 1) {
      // 狐狸半面
      const y = (l.y + r.y) / 2;
      g.fillStyle = 'rgba(250,248,244,0.95)';
      g.beginPath();
      g.moveTo(-fw * 0.55, y - fh * 0.22);
      g.lineTo(-fw * 0.42, y - fh * 0.55);
      g.lineTo(-fw * 0.22, y - fh * 0.28);
      g.lineTo(fw * 0.22, y - fh * 0.28);
      g.lineTo(fw * 0.42, y - fh * 0.55);
      g.lineTo(fw * 0.55, y - fh * 0.22);
      g.quadraticCurveTo(fw * 0.5, y + fh * 0.18, 0, y + fh * 0.2);
      g.quadraticCurveTo(-fw * 0.5, y + fh * 0.18, -fw * 0.55, y - fh * 0.22);
      g.fill();
      g.fillStyle = '#d62b3a';
      for (const p of [l, r]) {
        g.beginPath();
        g.ellipse(p.x, p.y, fw * 0.1, fw * 0.045, 0, 0, Math.PI * 2);
        g.globalCompositeOperation = 'destination-out';
        g.fill();
        g.globalCompositeOperation = 'source-over';
        g.strokeStyle = '#d62b3a';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(p.x - fw * 0.13 * Math.sign(p.x || 1), p.y - fw * 0.02);
        g.lineTo(p.x + fw * 0.16 * Math.sign(p.x || 1), p.y - fw * 0.08);
        g.stroke();
      }
      g.fillStyle = '#d62b3a';
      g.beginPath();
      g.moveTo(0, y - fh * 0.24);
      g.lineTo(-fw * 0.03, y - fh * 0.12);
      g.lineTo(fw * 0.03, y - fh * 0.12);
      g.fill();
    } else {
      // 脸谱：红脸 + 黑色眉眼纹
      g.fillStyle = 'rgba(200,30,40,0.55)';
      g.beginPath();
      g.ellipse(0, fh * 0.02, fw * 0.48, fh * 0.48, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(15,10,10,0.85)';
      g.lineWidth = fw * 0.03;
      g.lineCap = 'round';
      for (const p of [l, r]) {
        const s = Math.sign(p.x || 1);
        g.beginPath();
        g.moveTo(p.x - s * fw * 0.12, p.y - fh * 0.04);
        g.quadraticCurveTo(p.x, p.y - fh * 0.16, p.x + s * fw * 0.18, p.y - fh * 0.12);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(0, -fh * 0.4);
      g.lineTo(0, -fh * 0.15);
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.beginPath();
      g.ellipse(0, -fh * 0.3, fw * 0.035, fh * 0.07, 0, 0, Math.PI * 2);
      g.fill();
    }
  };

  const collar = (g: CanvasRenderingContext2D, F: Frame) => {
    const v = sel.collar;
    if (v === 3 || !F.shoulderL || !F.shoulderR) return;
    const L = F.shoulderL, R = F.shoulderR;
    const neck = { x: F.chin.x, y: F.chin.y + F.fh * 0.25 };
    const sw = Math.hypot(R.x - L.x, R.y - L.y);
    const mid = { x: (L.x + R.x) / 2, y: (L.y + R.y) / 2 };
    const down = { x: mid.x, y: Math.max(mid.y + sw * 0.55, neck.y + sw * 0.4) };
    if (v === 2) {
      // 云肩：四片如意云纹
      g.fillStyle = 'rgba(30,90,120,0.88)';
      g.strokeStyle = '#d8b46a';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(L.x - sw * 0.1, L.y + sw * 0.05);
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const x = L.x - sw * 0.1 + (R.x - L.x + sw * 0.2) * t;
        const y = mid.y + sw * 0.18 + Math.sin(t * Math.PI) * sw * 0.12 + (i % 2 ? sw * 0.06 : 0);
        g.lineTo(x, y);
      }
      g.lineTo(R.x + sw * 0.1, R.y + sw * 0.05);
      g.quadraticCurveTo(mid.x, neck.y - sw * 0.05, L.x - sw * 0.1, L.y + sw * 0.05);
      g.fill();
      g.stroke();
      g.beginPath();
      g.arc(mid.x, neck.y + sw * 0.08, sw * 0.05, 0, Math.PI * 2);
      g.fillStyle = '#d8b46a';
      g.fill();
      return;
    }
    const main = v === 0 ? '#b82a2a' : '#2f7a6a';
    const trim = v === 0 ? '#f0d48a' : '#e8f0e0';
    // 衣身
    g.fillStyle = main;
    g.beginPath();
    g.moveTo(L.x - sw * 0.15, L.y + sw * 0.08);
    g.quadraticCurveTo(L.x - sw * 0.05, L.y - sw * 0.05, neck.x - sw * 0.12, neck.y);
    g.lineTo(neck.x + sw * 0.12, neck.y);
    g.quadraticCurveTo(R.x + sw * 0.05, R.y - sw * 0.05, R.x + sw * 0.15, R.y + sw * 0.08);
    g.lineTo(R.x + sw * 0.2, h + 20);
    g.lineTo(L.x - sw * 0.2, h + 20);
    g.closePath();
    g.fill();
    // 交领（右衽：左襟压右襟）
    g.strokeStyle = trim;
    g.lineWidth = Math.max(6, sw * 0.07);
    g.lineCap = 'butt';
    g.beginPath();
    g.moveTo(neck.x + sw * 0.12, neck.y);
    g.lineTo(down.x - sw * 0.12, down.y);
    g.stroke();
    g.beginPath();
    g.moveTo(neck.x - sw * 0.12, neck.y);
    g.lineTo(down.x + sw * 0.18, down.y + sw * 0.12);
    g.stroke();
    // 中衣白边
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = Math.max(2, sw * 0.02);
    g.beginPath();
    g.moveTo(neck.x - sw * 0.06, neck.y + 2);
    g.lineTo(down.x + sw * 0.08, down.y + sw * 0.06);
    g.stroke();
  };

  const drawDummy = (g: CanvasRenderingContext2D, F: Frame) => {
    g.fillStyle = 'rgba(236,231,220,0.12)';
    g.strokeStyle = 'rgba(236,231,220,0.35)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.ellipse(F.c.x, F.c.y, F.fw * 0.5, F.fh * 0.5, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(F.shoulderL!.x, F.shoulderL!.y + 40);
    g.quadraticCurveTo(F.c.x, F.c.y + F.fh * 0.3, F.shoulderR!.x, F.shoulderR!.y + 40);
    g.stroke();
    g.fillStyle = 'rgba(236,231,220,0.4)';
    for (const p of [F.eyeL, F.eyeR]) {
      g.beginPath();
      g.arc(p.x, p.y, 4, 0, Math.PI * 2);
      g.fill();
    }
  };

  return {
    update(f: InputFrame) {
      const dt = f.dt;
      time += dt;
      const F = faceFrame(f.face, f.pose, w, h);
      // 歪头切换（滞回 + 冷却）
      if (f.face) {
        tiltLock = Math.max(0, tiltLock - dt);
        if (tiltLock === 0 && Math.abs(f.face.roll) > 0.32) {
          switchActive(f.face.roll > 0 ? 1 : -1);
          tiltLock = 1.1;
        }
      }
      c.clear();
      const g = c.ctx;
      if (!f.face) drawDummy(g, F);
      const cos = Math.cos(-F.roll), sin = Math.sin(-F.roll);
      const toLocal = (p: Pt): Pt => {
        const dx = p.x - F.c.x, dy = p.y - F.c.y;
        return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
      };
      collar(g, F);
      g.save();
      g.translate(F.c.x, F.c.y);
      g.rotate(F.roll);
      hairBack(g, F.fw, F.fh);
      makeup(g, F, toLocal);
      glasses(g, F, toLocal);
      hairFront(g, F.fw, F.fh);
      headwear(g, F.fw, F.fh);
      g.restore();
      if (flash > 0) {
        flash = Math.max(0, flash - dt * 2);
        const cat = CATS.find((x) => x.k === active)!;
        g.font = `600 18px ${FONT}`;
        g.textAlign = 'center';
        g.fillStyle = `rgba(243,226,176,${flash})`;
        g.fillText(`${cat.name} · ${cat.opts[sel[active]]}`, w / 2, 110);
      }
      if (!f.face) {
        g.font = `13px ${FONT}`;
        g.textAlign = 'center';
        g.fillStyle = 'rgba(236,231,220,0.7)';
        g.fillText(f.tracking ? '把脸对准镜头' : '示意人像 · 打开摄像头会戴到你脸上', w / 2, h * 0.13 + 8);
      }
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

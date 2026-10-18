/**
 * 节气签：挥手洗牌 → 五张牌扇形摊开 → 捏住一张抽出 → 翻面看签。
 */
import { SwipeDetector } from '../../engine/gestures';
import type { InputFrame } from '../../engine/types';
import { button, canvas2d, clamp, FONT, lerp, rand, SERIF } from '../kit';
import type { SceneContext, SceneInstance } from '../types';
import { DECK, SEASON_COLOR, shuffle, type Card } from './deck';

type Mode = 'deck' | 'shuffling' | 'fan' | 'picked';

interface Slot {
  card: Card;
  x: number;
  y: number;
  rot: number;
  tx: number;
  ty: number;
  trot: number;
  flip: number; // 0 背面 → 1 正面
  scale: number;
}

function wrapText(g: CanvasRenderingContext2D, text: string, maxW: number) {
  const lines: string[] = [];
  let cur = '';
  for (const ch of text) {
    if (g.measureText(cur + ch).width > maxW && cur) {
      lines.push(cur);
      cur = ch;
    } else cur += ch;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function create(ctx: SceneContext): SceneInstance {
  let w = ctx.width, h = ctx.height;
  const c = canvas2d(ctx.root, w, h);
  let mode: Mode = 'deck';
  let slots: Slot[] = [];
  let picked = -1;
  let hover = -1;
  let shuffleT = 0;
  let time = 0;
  const swipe = new SwipeDetector(0.18, 500, 900);
  const faceCache = new Map<string, HTMLCanvasElement>();

  const size = () => {
    const cw = clamp(Math.min(w * 0.24, h * 0.17), 70, 150);
    return { cw, ch: cw * 1.6 };
  };

  const doShuffle = () => {
    if (mode === 'shuffling') return;
    mode = 'shuffling';
    shuffleT = 0;
    picked = -1;
    ctx.audio.whoosh(true, 0.15);
    for (let i = 0; i < 6; i++) setTimeout(() => ctx.audio.noiseHit({ gain: 0.08, decay: 0.05, freq: 3500 }), i * 90);
    const deck = shuffle(DECK).slice(0, 5);
    slots = deck.map((card) => ({ card, x: w / 2, y: h * 0.45, rot: 0, tx: w / 2, ty: h * 0.45, trot: 0, flip: 0, scale: 1 }));
  };

  const layoutFan = () => {
    const { ch } = size();
    const n = slots.length;
    slots.forEach((s, i) => {
      const k = i - (n - 1) / 2;
      s.tx = w / 2 + k * Math.min(w * 0.17, 120);
      s.ty = h * 0.62 + Math.abs(k) * 14;
      s.trot = k * 0.12;
      s.scale = 1;
      s.flip = 0;
    });
    void ch;
  };

  button(ctx, '洗牌', doShuffle);
  button(ctx, '再抽一张', () => {
    if (mode === 'picked') {
      mode = 'fan';
      picked = -1;
      layoutFan();
    } else doShuffle();
  });

  const cardFace = (card: Card, cw: number, chh: number) => {
    const key = card.name + cw;
    let cv = faceCache.get(key);
    if (cv) return cv;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv = document.createElement('canvas');
    cv.width = cw * 2 * dpr;
    cv.height = chh * 2 * dpr;
    const g = cv.getContext('2d')!;
    g.scale(2 * dpr, 2 * dpr);
    const col = SEASON_COLOR[card.season];
    g.fillStyle = col.bg;
    g.beginPath();
    g.roundRect(0, 0, cw, chh, cw * 0.06);
    g.fill();
    g.strokeStyle = col.accent;
    g.lineWidth = 1;
    g.strokeRect(cw * 0.06, cw * 0.06, cw * 0.88, chh - cw * 0.12);
    // 节气意象：日/月 + 山 + 节气小景
    g.beginPath();
    g.arc(cw * 0.68, chh * 0.2, cw * 0.11, 0, Math.PI * 2);
    g.fillStyle = col.accent;
    g.globalAlpha = 0.85;
    g.fill();
    g.globalAlpha = 1;
    g.fillStyle = col.ink;
    g.globalAlpha = 0.18;
    g.beginPath();
    g.moveTo(cw * 0.06, chh * 0.42);
    for (let x = 0; x <= cw * 0.88; x += 4) g.lineTo(cw * 0.06 + x, chh * 0.36 + Math.sin(x * 0.08 + card.name.charCodeAt(0)) * chh * 0.03);
    g.lineTo(cw * 0.94, chh * 0.45);
    g.lineTo(cw * 0.06, chh * 0.45);
    g.fill();
    g.globalAlpha = 1;
    // 竖排节气名
    g.fillStyle = col.ink;
    g.font = `700 ${cw * 0.22}px ${SERIF}`;
    g.textAlign = 'center';
    g.fillText(card.name[0], cw * 0.27, chh * 0.2);
    g.fillText(card.name[1], cw * 0.27, chh * 0.2 + cw * 0.26);
    // 印章
    g.strokeStyle = '#b8322c';
    g.lineWidth = 1.2;
    g.strokeRect(cw * 0.73, chh * 0.32, cw * 0.14, cw * 0.14);
    g.fillStyle = '#b8322c';
    g.font = `700 ${cw * 0.09}px ${SERIF}`;
    g.fillText(card.season, cw * 0.8, chh * 0.32 + cw * 0.105);
    // 句子
    g.fillStyle = col.ink;
    g.font = `${cw * 0.085}px ${SERIF}`;
    const lines = wrapText(g, card.line, cw * 0.76);
    lines.forEach((ln, i) => g.fillText(ln, cw / 2, chh * 0.56 + i * cw * 0.12));
    g.font = `600 ${cw * 0.08}px ${FONT}`;
    g.fillStyle = col.accent;
    g.fillText(card.tip, cw / 2, chh * 0.9);
    faceCache.set(key, cv);
    return cv;
  };

  const drawBack = (g: CanvasRenderingContext2D, cw: number, chh: number, glow: number) => {
    const gr = g.createLinearGradient(-cw / 2, -chh / 2, cw / 2, chh / 2);
    gr.addColorStop(0, '#1b2a26');
    gr.addColorStop(1, '#0f1513');
    g.fillStyle = gr;
    g.beginPath();
    g.roundRect(-cw / 2, -chh / 2, cw, chh, cw * 0.06);
    g.fill();
    g.strokeStyle = `rgba(216,180,106,${0.6 + glow * 0.4})`;
    g.lineWidth = 1.2 + glow;
    g.shadowColor = '#d8b46a';
    g.shadowBlur = glow * 18;
    g.strokeRect(-cw * 0.42, -chh * 0.44, cw * 0.84, chh * 0.88);
    g.shadowBlur = 0;
    // 太极/回纹
    g.beginPath();
    g.arc(0, 0, cw * 0.2, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(216,180,106,0.7)';
    g.stroke();
    g.fillStyle = 'rgba(216,180,106,0.85)';
    g.font = `700 ${cw * 0.18}px ${SERIF}`;
    g.textAlign = 'center';
    g.fillText('签', 0, cw * 0.065);
  };

  return {
    update(f: InputFrame) {
      const dt = f.dt;
      time += dt;
      const { cw, ch } = size();
      // 挥手洗牌
      for (const hd of f.hands) {
        if (hd.source !== 'camera') continue;
        if ((hd.gesture === 'open' || hd.gesture === 'victory') && swipe.push(hd.palm.x, hd.palm.y, f.t, w)) doShuffle();
      }
      if (mode === 'deck') {
        hover = -1;
        for (const p of f.pinchStarted) if (Math.abs(p.pinchPt.x - w / 2) < cw && Math.abs(p.pinchPt.y - h * 0.45) < ch) doShuffle();
      } else if (mode === 'shuffling') {
        shuffleT += dt;
        slots.forEach((s, i) => {
          const ph = shuffleT * 10 + i;
          s.tx = w / 2 + Math.sin(ph) * cw * 0.6;
          s.ty = h * 0.45 + Math.cos(ph * 0.7) * 8;
          s.trot = Math.sin(ph) * 0.2;
        });
        if (shuffleT > 0.9) {
          mode = 'fan';
          layoutFan();
          ctx.audio.pluck(392, 0.15);
        }
      } else if (mode === 'fan') {
        // 指向 / 悬停
        const ptr = f.hands.find((x) => x.source === 'camera') ?? f.hands[0];
        hover = -1;
        if (ptr) {
          const p = ptr.source === 'camera' ? ptr.pinchPt : ptr.pinchPt;
          let best = Infinity;
          slots.forEach((s, i) => {
            const d = Math.hypot(p.x - s.x, (p.y - s.y) * 0.6);
            if (d < cw * 0.7 && d < best) {
              best = d;
              hover = i;
            }
          });
        }
        slots.forEach((s, i) => {
          if (i === hover) s.ty -= 0; // 高亮在绘制里做
        });
        for (const p of f.pinchStarted) {
          if (hover >= 0) {
            picked = hover;
            mode = 'picked';
            const s = slots[picked];
            s.tx = w / 2;
            s.ty = h * 0.42;
            s.trot = 0;
            s.scale = clamp(Math.min((w * 0.62) / cw, (h * 0.5) / ch), 1.2, 2.6);
            ctx.audio.whoosh(true, 0.1);
            setTimeout(() => {
              ctx.audio.chime(880, 0.12);
              ctx.audio.chime(1318, 0.08, 0.12);
            }, 400);
            slots.forEach((o, k) => {
              if (k !== picked) {
                o.ty = h + ch;
              }
            });
            void p;
            break;
          }
        }
      } else if (mode === 'picked') {
        const s = slots[picked];
        s.flip = Math.min(1, s.flip + dt * 1.6);
      }
      for (const s of slots) {
        const k = Math.min(1, dt * 9);
        s.x = lerp(s.x, s.tx, k);
        s.y = lerp(s.y, s.ty, k);
        s.rot = lerp(s.rot, s.trot, k);
      }

      // ---- 绘制 ----
      c.clear();
      const g = c.ctx;
      g.fillStyle = 'rgba(6,8,8,0.62)';
      g.fillRect(0, 0, w, h);
      // 金色星尘
      for (let i = 0; i < 40; i++) {
        const x = (i * 97.3 + time * 8 * (1 + (i % 3))) % w;
        const y = (i * 53.1 + Math.sin(time + i) * 10 + h) % h;
        g.fillStyle = `rgba(216,180,106,${0.2 + 0.2 * Math.sin(time * 2 + i)})`;
        g.fillRect(x, y, 1.6, 1.6);
      }
      g.textAlign = 'center';
      if (mode === 'deck') {
        for (let k = 4; k >= 0; k--) {
          g.save();
          g.translate(w / 2 + k * 2, h * 0.45 - k * 2);
          drawBack(g, cw, ch, k === 0 ? 0.5 + 0.5 * Math.sin(time * 3) : 0);
          g.restore();
        }
        g.font = `14px ${FONT}`;
        g.fillStyle = 'rgba(236,231,220,0.75)';
        g.fillText('张开手掌左右一挥，洗牌', w / 2, h * 0.45 + ch * 0.75);
      }
      const order = slots.map((_, i) => i).sort((a, b) => (a === picked ? 1 : b === picked ? -1 : 0));
      for (const i of order) {
        const s = slots[i];
        g.save();
        g.translate(s.x, s.y - (i === hover && mode === 'fan' ? 24 : 0));
        g.rotate(s.rot);
        const sc = lerp(1, s.scale, Math.min(1, s.flip * 3 + (mode === 'picked' && i === picked ? 0.4 : 0)));
        const fx = Math.cos(s.flip * Math.PI);
        g.scale(sc * Math.abs(fx), sc);
        if (s.flip < 0.5) drawBack(g, cw, ch, i === hover ? 1 : 0);
        else g.drawImage(cardFace(s.card, cw, ch), -cw / 2, -ch / 2, cw, ch);
        g.restore();
      }
      if (mode === 'fan') {
        g.font = `14px ${FONT}`;
        g.fillStyle = 'rgba(236,231,220,0.8)';
        g.fillText('指向一张牌，捏合抽出', w / 2, h * 0.62 - ch * 0.7);
      }
      if (mode === 'picked' && slots[picked]?.flip >= 1) {
        g.font = `13px ${FONT}`;
        g.fillStyle = 'rgba(236,231,220,0.7)';
        g.fillText('今日一签 · 仅供一笑', w / 2, Math.min(h - 120, h * 0.42 + (ch * slots[picked].scale) / 2 + 28));
      }
      void rand;
    },
    resize(nw, nh) {
      w = nw;
      h = nh;
      c.resize(w, h);
      faceCache.clear();
      if (mode === 'fan') layoutFan();
    },
    dispose() {
      faceCache.clear();
      c.dispose();
    },
  };
}

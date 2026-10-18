/**
 * 接福袋：手掌（或手指拖动）控制竹篮，接住福袋、元宝、红包，躲开爆竹。
 */
import type { InputFrame } from '../../engine/types';
import { GameClock } from '../gameKit';
import { button, canvas2d, drawFloatTexts, rand, SERIF, type FloatText } from '../kit';
import type { SceneContext, SceneInstance } from '../types';

type ItemKind = 'bag' | 'ingot' | 'packet' | 'cracker';
interface Item {
  kind: ItemKind;
  x: number;
  y: number;
  vy: number;
  rot: number;
  vr: number;
  r: number;
}
const SCORE: Record<ItemKind, number> = { bag: 3, ingot: 5, packet: 2, cracker: -5 };

export function create(ctx: SceneContext): SceneInstance {
  let w = ctx.width, h = ctx.height;
  const c = canvas2d(ctx.root, w, h);
  const game = new GameClock('lingjing.best.fudai.v1', 45);
  const items: Item[] = [];
  const floats: FloatText[] = [];
  const basket = { x: w / 2, y: h * 0.78 };
  let spawnT = 0;
  let shake = 0;
  let openT = 0;

  const startBtn = button(ctx, '开始', () => begin());
  const begin = () => {
    game.start();
    items.length = 0;
    startBtn.textContent = '重新开始';
    ctx.audio.success();
  };

  const drawItem = (g: CanvasRenderingContext2D, it: Item) => {
    g.save();
    g.translate(it.x, it.y);
    g.rotate(it.rot);
    const r = it.r;
    if (it.kind === 'bag') {
      g.fillStyle = '#d6332a';
      g.beginPath();
      g.moveTo(-r * 0.3, -r * 0.7);
      g.quadraticCurveTo(-r, -r * 0.2, -r * 0.85, r * 0.5);
      g.quadraticCurveTo(0, r * 1.05, r * 0.85, r * 0.5);
      g.quadraticCurveTo(r, -r * 0.2, r * 0.3, -r * 0.7);
      g.closePath();
      g.fill();
      g.fillStyle = '#f2c14e';
      g.fillRect(-r * 0.4, -r * 0.78, r * 0.8, r * 0.16);
      g.font = `700 ${r * 0.8}px ${SERIF}`;
      g.textAlign = 'center';
      g.fillText('福', 0, r * 0.45);
    } else if (it.kind === 'ingot') {
      g.fillStyle = '#f2c14e';
      g.beginPath();
      g.moveTo(-r, -r * 0.1);
      g.quadraticCurveTo(-r * 0.6, r * 0.7, 0, r * 0.6);
      g.quadraticCurveTo(r * 0.6, r * 0.7, r, -r * 0.1);
      g.quadraticCurveTo(r * 0.5, r * 0.15, 0, r * 0.1);
      g.quadraticCurveTo(-r * 0.5, r * 0.15, -r, -r * 0.1);
      g.fill();
      g.beginPath();
      g.ellipse(0, -r * 0.05, r * 0.4, r * 0.32, 0, 0, Math.PI * 2);
      g.fillStyle = '#ffd97a';
      g.fill();
    } else if (it.kind === 'packet') {
      g.fillStyle = '#e0352b';
      g.beginPath();
      g.roundRect(-r * 0.6, -r * 0.85, r * 1.2, r * 1.7, r * 0.15);
      g.fill();
      g.beginPath();
      g.arc(0, -r * 0.2, r * 0.25, 0, Math.PI * 2);
      g.fillStyle = '#f2c14e';
      g.fill();
    } else {
      g.fillStyle = '#9c1d18';
      g.fillRect(-r * 0.3, -r * 0.9, r * 0.6, r * 1.8);
      g.fillStyle = '#f2c14e';
      g.fillRect(-r * 0.3, -r * 0.2, r * 0.6, r * 0.12);
      g.strokeStyle = '#ddd';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, -r * 0.9);
      g.quadraticCurveTo(r * 0.3, -r * 1.2, r * 0.1, -r * 1.35);
      g.stroke();
      g.fillStyle = '#ffb347';
      g.beginPath();
      g.arc(r * 0.1, -r * 1.35, 3 + Math.random() * 2, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  };

  const drawBasket = (g: CanvasRenderingContext2D, x: number, y: number, bw: number) => {
    g.save();
    g.translate(x + (shake > 0 ? Math.sin(shake * 60) * 6 : 0), y);
    g.fillStyle = '#b7853f';
    g.beginPath();
    g.moveTo(-bw / 2, 0);
    g.lineTo(bw / 2, 0);
    g.lineTo(bw * 0.38, bw * 0.42);
    g.lineTo(-bw * 0.38, bw * 0.42);
    g.closePath();
    g.fill();
    g.strokeStyle = '#7a5424';
    g.lineWidth = 1.5;
    for (let i = 1; i < 4; i++) {
      g.beginPath();
      g.moveTo(-bw / 2 + (bw * 0.12 * i) / 4, (bw * 0.42 * i) / 4);
      g.lineTo(bw / 2 - (bw * 0.12 * i) / 4, (bw * 0.42 * i) / 4);
      g.stroke();
    }
    for (let i = -3; i <= 3; i++) {
      g.beginPath();
      g.moveTo((i * bw) / 7, 0);
      g.lineTo((i * bw * 0.76) / 7, bw * 0.42);
      g.stroke();
    }
    g.beginPath();
    g.ellipse(0, 0, bw / 2, bw * 0.08, 0, 0, Math.PI * 2);
    g.strokeStyle = '#d9a95a';
    g.lineWidth = 4;
    g.stroke();
    g.restore();
  };

  return {
    update(f: InputFrame) {
      const dt = f.dt;
      const bw = Math.min(150, w * 0.3);
      const hd = f.hands.find((x) => x.source === 'camera') ?? f.hands.find((x) => x.pinching) ?? (f.hands[0]?.source === 'touch' ? f.hands[0] : undefined);
      if (hd) {
        const p = hd.source === 'camera' ? hd.palm : hd.pinchPt;
        basket.x += (p.x - basket.x) * Math.min(1, dt * 16);
        basket.y += (Math.min(Math.max(p.y, h * 0.35), h - 140) - basket.y) * Math.min(1, dt * 16);
        // 张开手掌 1 秒开始
        if (game.state !== 'play' && hd.source === 'camera' && hd.gesture === 'open') {
          openT += dt;
          if (openT > 1) {
            openT = 0;
            begin();
          }
        } else openT = 0;
      }
      if (game.state !== 'play') for (const p of f.pinchStarted) if (p.source === 'touch' && p.pinchPt.y > h * 0.3 && p.pinchPt.y < h * 0.6) begin();
      if (game.tick(dt)) {
        ctx.audio.success();
        startBtn.textContent = '再来一局';
      }
      if (game.state === 'play') {
        spawnT -= dt;
        const pace = 1 + (1 - game.timeLeft / game.duration) * 1.4;
        if (spawnT <= 0) {
          spawnT = rand(0.35, 0.8) / pace;
          const roll = Math.random();
          const kind: ItemKind = roll < 0.18 ? 'cracker' : roll < 0.3 ? 'ingot' : roll < 0.62 ? 'bag' : 'packet';
          items.push({ kind, x: rand(30, w - 30), y: -30, vy: rand(160, 260) * pace, rot: rand(-0.3, 0.3), vr: rand(-1.5, 1.5), r: Math.min(26, w * 0.06) });
        }
      }
      shake = Math.max(0, shake - dt);
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.y += it.vy * dt;
        it.rot += it.vr * dt;
        const caught = Math.abs(it.x - basket.x) < bw * 0.5 && it.y > basket.y - it.r && it.y < basket.y + bw * 0.25;
        if (caught && game.state === 'play') {
          items.splice(i, 1);
          const s = SCORE[it.kind];
          if (s > 0) {
            game.combo++;
            const bonus = game.combo >= 5 ? 1 : 0;
            game.score += s + bonus;
            floats.push({ x: it.x, y: it.y - 20, text: `+${s + bonus}`, life: 0.9, color: '#ffd36b', size: 22 });
            ctx.audio.chime(880 + Math.min(game.combo, 10) * 60, 0.12);
          } else {
            game.combo = 0;
            game.score = Math.max(0, game.score + s);
            shake = 0.3;
            floats.push({ x: it.x, y: it.y - 20, text: '砰！-5', life: 0.9, color: '#ff6a5a', size: 24 });
            ctx.audio.noiseHit({ gain: 0.4, decay: 0.3, type: 'lowpass', freq: 600 });
          }
          continue;
        }
        if (it.y > h + 40) {
          if (it.kind !== 'cracker') game.combo = 0;
          items.splice(i, 1);
        }
      }

      c.clear();
      const g = c.ctx;
      g.fillStyle = 'rgba(40,6,6,0.25)';
      g.fillRect(0, 0, w, h);
      // 灯笼装饰
      for (const lx of [w * 0.1, w * 0.9]) {
        g.strokeStyle = 'rgba(216,180,106,0.6)';
        g.beginPath();
        g.moveTo(lx, 0);
        g.lineTo(lx, 64);
        g.stroke();
        g.fillStyle = 'rgba(214,51,42,0.85)';
        g.beginPath();
        g.ellipse(lx, 84, 18, 22, 0, 0, Math.PI * 2);
        g.fill();
      }
      for (const it of items) drawItem(g, it);
      drawBasket(g, basket.x, basket.y, bw);
      drawFloatTexts(g, floats, dt);
      game.drawHud(g, w);
      if (game.state !== 'play') {
        game.drawPanel(g, w, h, '接福袋', game.state === 'over' ? ['张开手掌停 1 秒，或点「再来一局」'] : ['手掌控制竹篮，接福袋、元宝、红包', '躲开爆竹 · 45 秒', '张开手掌停 1 秒开始 / 点这里开始']);
        if (openT > 0) {
          g.beginPath();
          g.arc(w / 2, h * 0.36 + 120, 18, -Math.PI / 2, -Math.PI / 2 + openT * Math.PI * 2);
          g.strokeStyle = '#5fe3b0';
          g.lineWidth = 4;
          g.stroke();
        }
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

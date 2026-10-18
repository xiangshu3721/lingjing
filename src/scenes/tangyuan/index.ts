/**
 * 张嘴吃汤圆：移动头部让嘴对准飞来的汤圆，张嘴就吃掉；辣椒别吃！眨眼一下 = 召唤一颗金汤圆。
 * 触屏：点汤圆吃掉。
 */
import type { InputFrame, Pt } from '../../engine/types';
import { GameClock } from '../gameKit';
import { button, canvas2d, dist, drawFloatTexts, rand, type FloatText } from '../kit';
import type { SceneContext, SceneInstance } from '../types';

type Kind = 'ball' | 'gold' | 'pepper';
interface Item {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
}

export function create(ctx: SceneContext): SceneInstance {
  let w = ctx.width, h = ctx.height;
  const c = canvas2d(ctx.root, w, h);
  const game = new GameClock('lingjing.best.tangyuan.v1', 40);
  const items: Item[] = [];
  const floats: FloatText[] = [];
  let spawnT = 0;
  let wasBlink = false;
  let mouthOpenT = 0;
  let chew = 0;

  const startBtn = button(ctx, '开始', () => begin());
  const begin = () => {
    game.start();
    items.length = 0;
    startBtn.textContent = '重新开始';
    ctx.audio.success();
  };

  const spawn = (kind?: Kind) => {
    const k: Kind = kind ?? (Math.random() < 0.2 ? 'pepper' : Math.random() < 0.1 ? 'gold' : 'ball');
    const fromLeft = Math.random() < 0.5;
    const y = rand(h * 0.2, h * 0.6);
    items.push({ kind: k, x: fromLeft ? -30 : w + 30, y, vx: (fromLeft ? 1 : -1) * rand(70, 140), vy: rand(-20, 20), r: Math.min(24, w * 0.055), rot: 0 });
  };

  const eat = (it: Item, at: Pt) => {
    if (it.kind === 'pepper') {
      game.combo = 0;
      game.score = Math.max(0, game.score - 3);
      floats.push({ x: at.x, y: at.y - 30, text: '好辣！-3', life: 1, color: '#ff6a5a', size: 22 });
      ctx.audio.fail();
    } else {
      const s = it.kind === 'gold' ? 5 : 1;
      game.combo++;
      game.score += s;
      floats.push({ x: at.x, y: at.y - 30, text: it.kind === 'gold' ? '金汤圆 +5' : '+1', life: 0.9, color: '#ffd36b', size: 22 });
      ctx.audio.pop(500 + Math.min(game.combo, 8) * 50);
    }
    chew = 0.4;
  };

  const drawItem = (g: CanvasRenderingContext2D, it: Item) => {
    g.save();
    g.translate(it.x, it.y);
    g.rotate(it.rot);
    if (it.kind === 'pepper') {
      g.fillStyle = '#e0352b';
      g.beginPath();
      g.moveTo(-it.r, -it.r * 0.3);
      g.quadraticCurveTo(0, -it.r * 0.6, it.r, it.r * 0.4);
      g.quadraticCurveTo(0, it.r * 0.3, -it.r, it.r * 0.2);
      g.fill();
      g.fillStyle = '#3f8a3a';
      g.fillRect(-it.r * 1.2, -it.r * 0.25, it.r * 0.35, it.r * 0.35);
    } else {
      const gr = g.createRadialGradient(-it.r * 0.3, -it.r * 0.3, 2, 0, 0, it.r);
      gr.addColorStop(0, it.kind === 'gold' ? '#fff3c4' : '#ffffff');
      gr.addColorStop(1, it.kind === 'gold' ? '#e2a93a' : '#e6e0d6');
      g.fillStyle = gr;
      g.shadowColor = it.kind === 'gold' ? '#ffd36b' : 'rgba(255,255,255,0.6)';
      g.shadowBlur = 12;
      g.beginPath();
      g.arc(0, 0, it.r, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  };

  return {
    update(f: InputFrame) {
      const dt = f.dt;
      const face = f.face;
      const mouthOpen = !!face && face.mouthOpen > 0.38;
      if (face) {
        // 眨眼 → 召唤金汤圆
        const blink = face.blink > 0.6;
        if (blink && !wasBlink && game.state === 'play' && Math.random() < 0.5) spawn('gold');
        wasBlink = blink;
        // 张嘴 1.2 秒开始
        if (game.state !== 'play' && mouthOpen) {
          mouthOpenT += dt;
          if (mouthOpenT > 1.2) {
            mouthOpenT = 0;
            begin();
          }
        } else mouthOpenT = 0;
      }
      if (game.state !== 'play') for (const p of f.pinchStarted) if (p.source === 'touch' && p.pinchPt.y > h * 0.25 && p.pinchPt.y < h * 0.6) begin();
      if (game.tick(dt)) {
        ctx.audio.success();
        startBtn.textContent = '再来一局';
      }
      if (game.state === 'play') {
        spawnT -= dt;
        if (spawnT <= 0) {
          spawnT = rand(0.5, 1.1);
          spawn();
        }
      }
      chew = Math.max(0, chew - dt);
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.x += it.vx * dt;
        it.y += it.vy * dt + Math.sin(it.x * 0.02) * 0.6;
        it.rot += dt;
        if (game.state === 'play') {
          if (face && mouthOpen && dist(face.mouth, it) < face.width * 0.28 + it.r) {
            eat(it, face.mouth);
            items.splice(i, 1);
            continue;
          }
          const tap = f.pinchStarted.find((p) => p.source === 'touch' && dist(p.pinchPt, it) < it.r * 1.8);
          if (tap) {
            eat(it, tap.pinchPt);
            items.splice(i, 1);
            continue;
          }
        }
        if (it.x < -60 || it.x > w + 60) items.splice(i, 1);
      }

      c.clear();
      const g = c.ctx;
      for (const it of items) drawItem(g, it);
      if (face) {
        // 嘴部光圈
        const R = face.width * 0.28;
        g.beginPath();
        g.arc(face.mouth.x, face.mouth.y, R * (mouthOpen ? 1 : 0.7), 0, Math.PI * 2);
        g.strokeStyle = mouthOpen ? 'rgba(95,227,176,0.9)' : 'rgba(255,255,255,0.35)';
        g.lineWidth = mouthOpen ? 3 : 1.5;
        g.setLineDash(mouthOpen ? [] : [5, 6]);
        g.stroke();
        g.setLineDash([]);
        if (chew > 0) {
          g.font = '600 18px system-ui';
          g.fillStyle = '#fff';
          g.textAlign = 'center';
          g.fillText('嚼嚼', face.mouth.x + R + 22, face.mouth.y);
        }
      }
      drawFloatTexts(g, floats, dt);
      game.drawHud(g, w);
      if (game.state !== 'play') {
        game.drawPanel(g, w, h, '张嘴吃汤圆', game.state === 'over' ? ['张嘴停一下，或点「再来一局」'] : ['移动头部让嘴对准汤圆，张嘴就吃', '辣椒别吃 · 眨眼可能召唤金汤圆', '张嘴 1 秒开始 / 点这里开始']);
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

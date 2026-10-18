/** 小游戏通用：倒计时、分数、最佳纪录、开始/结束面板 */
import { FONT, loadNumber, saveNumber, SERIF } from './kit';

export type GameState = 'ready' | 'play' | 'over';

export class GameClock {
  state: GameState = 'ready';
  score = 0;
  timeLeft: number;
  best: number;
  combo = 0;
  constructor(private key: string, public duration = 45) {
    this.timeLeft = duration;
    this.best = loadNumber(key, 0);
  }
  start() {
    this.state = 'play';
    this.score = 0;
    this.combo = 0;
    this.timeLeft = this.duration;
  }
  tick(dt: number): boolean {
    if (this.state !== 'play') return false;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.state = 'over';
      const newBest = this.score > this.best;
      if (newBest) {
        this.best = this.score;
        saveNumber(this.key, this.best);
      }
      return true;
    }
    return false;
  }
  drawHud(g: CanvasRenderingContext2D, w: number) {
    g.save();
    g.textAlign = 'left';
    g.font = `700 22px ${SERIF}`;
    g.fillStyle = '#f3e2b0';
    g.shadowColor = '#000';
    g.shadowBlur = 6;
    g.fillText(`${this.score} 分`, 16, 96);
    g.font = `13px ${FONT}`;
    g.fillStyle = 'rgba(236,231,220,0.75)';
    g.fillText(`最佳 ${this.best}${this.combo > 2 ? `   连击 ×${this.combo}` : ''}`, 16, 116);
    g.textAlign = 'right';
    g.font = `700 22px ${SERIF}`;
    g.fillStyle = this.timeLeft < 10 ? '#ff7a6a' : '#f3e2b0';
    g.fillText(`${Math.ceil(this.timeLeft)}″`, w - 16, 96);
    g.restore();
  }
  drawPanel(g: CanvasRenderingContext2D, w: number, h: number, title: string, lines: string[]) {
    g.save();
    g.fillStyle = 'rgba(6,7,9,0.55)';
    g.fillRect(0, 0, w, h);
    const pw = Math.min(w * 0.86, 360), ph = 190;
    const x = (w - pw) / 2, y = h * 0.36 - ph / 2;
    g.fillStyle = 'rgba(14,16,20,0.88)';
    g.strokeStyle = 'rgba(216,180,106,0.5)';
    g.beginPath();
    g.roundRect(x, y, pw, ph, 18);
    g.fill();
    g.stroke();
    g.textAlign = 'center';
    g.font = `700 26px ${SERIF}`;
    g.fillStyle = '#f3e2b0';
    g.fillText(this.state === 'over' ? `${this.score} 分${this.score >= this.best && this.score > 0 ? ' · 新纪录！' : ''}` : title, w / 2, y + 50);
    g.font = `14px ${FONT}`;
    g.fillStyle = 'rgba(236,231,220,0.85)';
    lines.forEach((l, i) => g.fillText(l, w / 2, y + 88 + i * 24));
    g.restore();
  }
}

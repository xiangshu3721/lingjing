/**
 * 写书法：宣纸上的毛笔。捏合拇指与食指落笔，松开抬笔。
 * 起笔细、行笔慢则中锋饱、快则飞白，收笔收到尖。浓淡、撤销、清空都留在本机。
 */
import type { Hand, InputFrame } from '../../engine/types';
import { SERIF, button, canvas2d } from '../kit';
import type { SceneContext, SceneInstance } from '../types';
import {
  brushBase,
  brushRadius,
  isJump,
  packDoc,
  scaleStrokes,
  unpackDoc,
  withTail,
  type InkTone,
  type Stroke,
  type StrokePoint,
} from './brush';

const STORE_KEY = 'lingjing.calligraphy.v1';

const TONES: { name: string; rgb: string; core: number; bleed: number; spine: number }[] = [
  { name: '浓墨', rgb: '24,18,14', core: 0.9, bleed: 0.16, spine: 0.55 },
  { name: '淡墨', rgb: '92,78,62', core: 0.4, bleed: 0.1, spine: 0.22 },
];

interface LiveStroke {
  tone: InkTone;
  pts: StrokePoint[];
  traveled: number;
  hold: number;
}

export function create(ctx: SceneContext): SceneInstance {
  let w = ctx.width;
  let h = ctx.height;
  const dprCap = Math.min(1.5, window.devicePixelRatio || 1);
  const paper = canvas2d(ctx.root, w, h, dprCap);
  const ink = canvas2d(ctx.root, w, h, dprCap);
  const live = canvas2d(ctx.root, w, h, dprCap);
  const deco = canvas2d(ctx.root, w, h, dprCap);
  const fx = canvas2d(ctx.root, w, h, dprCap);
  fx.canvas.dataset.nophoto = '1';

  const scratch = document.createElement('canvas');
  const sg = scratch.getContext('2d')!;
  fitScratch();

  let tone: InkTone = 0;
  let sealOn = true;
  const strokes: Stroke[] = [];
  const writing = new Map<number, LiveStroke>();
  let brushR = brushBase(w, h);
  let lastSnd = 0;
  let time = 0;

  const toneBtn = button(ctx, '浓墨', () => {
    tone = tone === 0 ? 1 : 0;
    toneBtn.textContent = TONES[tone].name;
    toneBtn.classList.toggle('on', tone === 1);
    ctx.toast(tone === 0 ? '换成浓墨' : '换成淡墨');
  }, { title: '切换浓墨和淡墨' });

  const undoBtn = button(ctx, '撤销', undo, { title: '撤销一笔' });
  button(ctx, '清空', clearPaper, { title: '清空纸面' });
  button(ctx, '保存', savePng, { title: '把字保存到本机' });
  const sealBtn = button(ctx, '印', () => {
    sealOn = !sealOn;
    sealBtn.classList.toggle('on', sealOn);
    paintDeco();
  }, { title: '显示或藏起角落的印章' });
  sealBtn.classList.add('on');

  paintPaper();
  paintDeco();
  restore();
  refreshUndo();

  function fitScratch() {
    scratch.width = Math.max(1, Math.round(w * paper.dpr));
    scratch.height = Math.max(1, Math.round(h * paper.dpr));
  }

  function scratchClear() {
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.clearRect(0, 0, scratch.width, scratch.height);
    sg.setTransform(paper.dpr, 0, 0, paper.dpr, 0, 0);
  }

  function blit(target: CanvasRenderingContext2D, alpha: number) {
    if (alpha <= 0.01) return;
    target.save();
    target.globalAlpha = alpha;
    target.drawImage(scratch, 0, 0, w, h);
    target.restore();
  }

  function paintPaper() {
    const g = paper.ctx;
    paper.clear();
    g.fillStyle = '#f4ead8';
    g.fillRect(0, 0, w, h);
    const rng = makeRng(20261018);
    // 帘纹：抄纸时留下的横丝
    g.strokeStyle = 'rgba(150, 118, 72, 0.045)';
    g.lineWidth = 1;
    for (let y = 0; y < h; y += 6) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y + Math.sin(y * 0.02) * 0.6);
      g.stroke();
    }
    // 纸纤维
    g.strokeStyle = 'rgba(110, 82, 48, 0.05)';
    for (let i = 0; i < 220; i++) {
      const x = rng() * w;
      const y = rng() * h;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rng() - 0.5) * 28, y + (rng() - 0.5) * 3);
      g.stroke();
    }
    for (let i = 0; i < 700; i++) {
      g.fillStyle = `rgba(90, 64, 36, ${0.015 + rng() * 0.04})`;
      g.fillRect(rng() * w, rng() * h, 0.6 + rng() * 1.4, 0.5 + rng());
    }
    // 暖调与边晕，中间留白给字
    const glow = g.createRadialGradient(w * 0.5, h * 0.46, Math.min(w, h) * 0.1, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
    glow.addColorStop(0, 'rgba(255, 250, 240, 0.35)');
    glow.addColorStop(0.62, 'rgba(210, 180, 130, 0)');
    glow.addColorStop(1, 'rgba(120, 84, 48, 0.22)');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);

    g.save();
    g.globalAlpha = 0.04;
    g.fillStyle = '#5c4632';
    g.font = `600 ${Math.min(w, h) * 0.42}px ${SERIF}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.translate(w * 0.5, h * 0.45);
    g.rotate(-0.05);
    g.fillText('書', 0, 0);
    g.restore();

    const m = Math.max(16, Math.min(w, h) * 0.035);
    g.strokeStyle = 'rgba(92, 62, 32, 0.22)';
    g.lineWidth = 1;
    g.strokeRect(m, m, w - m * 2, h - m * 2);
    g.strokeStyle = 'rgba(168, 48, 40, 0.28)';
    g.lineWidth = 0.8;
    g.strokeRect(m + 5, m + 5, w - m * 2 - 10, h - m * 2 - 10);
    drawInkstone(g, m + 48, h - Math.max(132, m + 52));
  }

  function paintDeco() {
    deco.clear();
    if (!sealOn) return;
    const m = Math.max(16, Math.min(w, h) * 0.035);
    const x = w - m - 26;
    const y = h - Math.max(118, m + 36);
    drawSeal(deco.ctx, x, y);
  }

  function redrawInk() {
    ink.clear();
    for (const s of strokes) paintStroke(ink.ctx, s.pts, s.tone);
  }

  function redrawLive() {
    live.clear();
    for (const s of writing.values()) paintStroke(live.ctx, s.pts, s.tone);
  }

  function paintStroke(target: CanvasRenderingContext2D, raw: StrokePoint[], which: InkTone) {
    const pts = smoothPts(raw);
    if (!pts.length) return;
    const spec = TONES[which];
    const pass = (body: StrokePoint[], mul: number, alpha: number, cut: boolean) => {
      scratchClear();
      sg.fillStyle = `rgb(${spec.rgb})`;
      stampAll(body, mul);
      if (cut) cutDry(body);
      blit(target, alpha);
    };
    pass(pts, 1.85, spec.bleed, false);
    pass(pts, 1, spec.core, true);
    const spine = pts.map((p) => ({ ...p, w: p.w * (1 - p.dry) * 0.38 }));
    if (spine.some((p) => p.w > 0.4)) pass(spine, 1, spec.spine, false);
  }

  function stampAll(pts: StrokePoint[], mul: number) {
    const put = (x: number, y: number, r: number) => {
      if (r < 0.2) return;
      sg.beginPath();
      sg.arc(x, y, r, 0, Math.PI * 2);
      sg.fill();
    };
    put(pts[0].x, pts[0].y, Math.max(0.2, pts[0].w * mul));
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const step = Math.max(0.85, Math.min(a.w, b.w) * mul * 0.42);
      const n = Math.max(1, Math.ceil(dist / step));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const r = (a.w + (b.w - a.w) * t) * mul;
        put(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, r);
      }
    }
  }

  function cutDry(pts: StrokePoint[]) {
    sg.save();
    sg.globalCompositeOperation = 'destination-out';
    sg.lineCap = 'butt';
    for (let i = 1; i < pts.length; i++) {
      const dry = (pts[i - 1].dry + pts[i].dry) * 0.5;
      if (dry < 0.45) continue;
      const ax = pts[i].x - pts[i - 1].x;
      const ay = pts[i].y - pts[i - 1].y;
      const len = Math.hypot(ax, ay) || 1;
      const nx = -ay / len;
      const ny = ax / len;
      const strands = 1 + Math.floor(dry * 3);
      for (let k = 0; k < strands; k++) {
        const h1 = hash(i * 17 + k * 5);
        if (h1 > 0.25 + dry * 0.65) continue;
        const off = (h1 - 0.5) * pts[i].w * 1.2;
        sg.strokeStyle = `rgba(0,0,0,${0.4 + dry * 0.55})`;
        sg.lineWidth = 0.35 + hash(i * 3 + k) * (0.45 + dry * 0.9);
        sg.beginPath();
        sg.moveTo(pts[i - 1].x + nx * off, pts[i - 1].y + ny * off);
        sg.lineTo(pts[i].x + nx * off, pts[i].y + ny * off);
        sg.stroke();
      }
    }
    sg.restore();
  }

  function undo() {
    if (!strokes.length) {
      ctx.toast('还没有可以收回的一笔');
      return;
    }
    strokes.pop();
    redrawInk();
    persist();
    refreshUndo();
    ctx.toast('已收回一笔');
  }

  function clearPaper() {
    strokes.length = 0;
    writing.clear();
    ink.clear();
    live.clear();
    persist();
    refreshUndo();
    ctx.toast('已铺开一张新纸');
  }

  function savePng() {
    persist();
    const c = document.createElement('canvas');
    c.width = paper.canvas.width;
    c.height = paper.canvas.height;
    const g = c.getContext('2d');
    if (!g) {
      ctx.toast('没能存成图片');
      return;
    }
    g.drawImage(paper.canvas, 0, 0);
    g.drawImage(ink.canvas, 0, 0);
    g.drawImage(live.canvas, 0, 0);
    if (sealOn) g.drawImage(deco.canvas, 0, 0);
    c.toBlob((blob) => {
      if (!blob) {
        ctx.toast('没能存成图片');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '');
      a.download = `灵境-写书法-${stamp}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      ctx.toast(strokes.length ? '已保存到本机' : '已保存（纸上还没有字）');
    }, 'image/png');
  }

  function refreshUndo() {
    undoBtn.disabled = strokes.length === 0;
  }

  function persist() {
    try {
      if (!strokes.length) {
        localStorage.removeItem(STORE_KEY);
        return;
      }
      const json = packDoc({ v: 1, w, h, strokes });
      if (json) localStorage.setItem(STORE_KEY, json);
    } catch {
      /* 隐私模式或配额满了就只留在这一页 */
    }
  }

  function restore() {
    try {
      const doc = unpackDoc(localStorage.getItem(STORE_KEY));
      if (!doc?.strokes.length) return;
      strokes.push(...scaleStrokes(doc, w, h));
      redrawInk();
      ctx.toast('接着上次的字写');
    } catch {
      /* ignore */
    }
  }

  function finish(id: number) {
    const s = writing.get(id);
    if (!s) return;
    writing.delete(id);
    if (!s.pts.length) return;
    const done: Stroke = { tone: s.tone, pts: withTail(s.pts, brushBase(w, h)) };
    strokes.push(done);
    paintStroke(ink.ctx, done.pts, done.tone);
    persist();
    refreshUndo();
  }

  function grow(hd: Hand, dt: number) {
    const p = hd.pinchPt;
    let s = writing.get(hd.id);
    const span = Math.max(w, h) * 0.22;
    if (s && isJump(s.pts[s.pts.length - 1], p, span)) finish(hd.id);
    s = writing.get(hd.id);
    if (!s) {
      s = { tone, pts: [], traveled: 0, hold: 0 };
      writing.set(hd.id, s);
    }
    const prev = s.pts[s.pts.length - 1];
    const step = prev ? Math.hypot(p.x - prev.x, p.y - prev.y) : 0;
    const speed = step / Math.max(dt, 1 / 120);
    if (speed < 36) s.hold = Math.min(0.6, s.hold + dt);
    else s.hold = Math.max(0, s.hold - dt * 2);
    const pool = Math.min(0.34, s.hold / 0.45);
    const shaped = brushRadius({
      speed,
      pinchRatio: hd.pinchRatio,
      source: hd.source,
      traveled: s.traveled,
      base: brushBase(w, h),
    });
    let ww = shaped.w * (1 + pool);
    const dry = shaped.dry;
    if (prev) ww = prev.w * 0.42 + ww * 0.58;
    brushR = ww;
    if (!prev) {
      s.pts.push({ x: p.x, y: p.y, w: shaped.w, dry });
      return;
    }
    if (step < 1.35) {
      prev.w = prev.w * 0.82 + ww * 0.18;
      prev.dry = prev.dry * 0.8 + dry * 0.2;
      return;
    }
    s.traveled += step;
    s.pts.push({ x: p.x, y: p.y, w: ww, dry });
    if (time - lastSnd > 0.09) {
      lastSnd = time;
      ctx.audio.noiseHit({ gain: 0.025, decay: 0.045, freq: 1400 + Math.min(1800, speed), type: 'highpass', q: 0.7 });
    }
  }

  function drawCursor() {
    fx.clear();
    const g = fx.ctx;
    for (const hd of lastHands) {
      const p = hd.pinchPt;
      const r = hd.pinching ? Math.max(brushR, 2) : brushBase(w, h) * 0.34;
      g.save();
      g.translate(p.x, p.y);
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.strokeStyle = hd.pinching ? 'rgba(24,18,14,0.55)' : 'rgba(24,18,14,0.28)';
      g.lineWidth = 1;
      g.stroke();
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(-2.2, -14);
      g.lineTo(2.2, -14);
      g.closePath();
      g.fillStyle = hd.pinching ? 'rgba(24,18,14,0.88)' : 'rgba(24,18,14,0.4)';
      g.fill();
      g.strokeStyle = 'rgba(92, 58, 28, 0.75)';
      g.lineWidth = 2.4;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(0, -13);
      g.lineTo(7, -36);
      g.stroke();
      g.restore();
    }
  }

  let lastHands: Hand[] = [];

  return {
    update(f: InputFrame) {
      const dt = Math.min(0.05, f.dt || 1 / 60);
      time += dt;
      brushR = brushBase(w, h) * 0.45;
      const seen = new Set<number>();
      for (const hd of f.hands) {
        seen.add(hd.id);
        if (hd.pinching) grow(hd, dt);
        else if (writing.has(hd.id)) finish(hd.id);
      }
      for (const id of [...writing.keys()]) if (!seen.has(id)) finish(id);
      lastHands = f.hands;
      redrawLive();
      drawCursor();
    },
    resize(nw, nh) {
      if (nw === w && nh === h) return;
      const sx = w > 0 ? nw / w : 1;
      const sy = h > 0 ? nh / h : 1;
      const sw = (sx + sy) / 2;
      const mapPt = (p: StrokePoint): StrokePoint => ({ x: p.x * sx, y: p.y * sy, w: Math.max(0.2, p.w * sw), dry: p.dry });
      for (const s of strokes) s.pts = s.pts.map(mapPt);
      for (const s of writing.values()) {
        s.pts = s.pts.map(mapPt);
        s.traveled *= sw;
      }
      w = nw;
      h = nh;
      paper.resize(w, h);
      ink.resize(w, h);
      live.resize(w, h);
      deco.resize(w, h);
      fx.resize(w, h);
      fitScratch();
      paintPaper();
      paintDeco();
      redrawInk();
      redrawLive();
      persist();
    },
    dispose() {
      paper.dispose();
      ink.dispose();
      live.dispose();
      deco.dispose();
      fx.dispose();
      scratch.width = scratch.height = 0;
    },
  };
}

function smoothPts(pts: StrokePoint[]): StrokePoint[] {
  if (pts.length < 3) return pts;
  const out: StrokePoint[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const c = pts[i + 1];
    out.push({
      x: a.x * 0.2 + b.x * 0.6 + c.x * 0.2,
      y: a.y * 0.2 + b.y * 0.6 + c.y * 0.2,
      w: a.w * 0.2 + b.w * 0.6 + c.w * 0.2,
      dry: b.dry,
    });
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawInkstone(g: CanvasRenderingContext2D, x: number, y: number) {
  g.save();
  g.translate(x, y);
  g.rotate(-0.25);
  g.beginPath();
  g.ellipse(0, 0, 30, 18, 0, 0, Math.PI * 2);
  g.fillStyle = 'rgba(62, 50, 40, 0.38)';
  g.fill();
  g.strokeStyle = 'rgba(40, 28, 18, 0.35)';
  g.lineWidth = 1;
  g.stroke();
  g.beginPath();
  g.ellipse(-1, 1, 13, 7.5, 0, 0, Math.PI * 2);
  g.fillStyle = 'rgba(16, 12, 10, 0.78)';
  g.fill();
  g.beginPath();
  g.ellipse(-5, -1, 4, 1.8, -0.4, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255, 255, 255, 0.16)';
  g.fill();
  g.restore();
}

function drawSeal(g: CanvasRenderingContext2D, x: number, y: number) {
  g.save();
  g.translate(x, y);
  g.rotate(-0.08);
  g.strokeStyle = 'rgba(176, 42, 36, 0.9)';
  g.lineWidth = 1.6;
  g.strokeRect(-16, -16, 32, 32);
  g.strokeRect(-13.5, -13.5, 27, 27);
  g.fillStyle = 'rgba(176, 42, 36, 0.9)';
  g.font = `700 12px ${SERIF}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('灵', 0, -6.5);
  g.fillText('境', 0, 7);
  g.restore();
}

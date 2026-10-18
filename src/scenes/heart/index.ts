/**
 * 心动星河（复刻视频 3）：
 * - 捏合在空中画霓虹粉色的心（画成闭合形会自动变成标准爱心并跳动）
 * - 张开手（从捏合/握拳一下张开）→ 金色星星粒子爆发 + 闪光
 * - 张开手掌快速挥动 → 跟随手的液态水波折射
 * - 掌心平摊对着镜头、静止 1 秒 → 催眠摆出现（zZZ），画面渐渐变黑
 */
import * as THREE from 'three';
import { coverUv } from '../../engine/mapping';
import type { Hand, InputFrame } from '../../engine/types';
import { button, canvas2d, clamp, dist, FONT, rand } from '../kit';
import { createThreeStage, posterCanvas } from '../threeKit';
import type { SceneContext, SceneInstance } from '../types';

const MAX_RIPPLES = 12;

const frag = /* glsl */ `
precision highp float;
uniform sampler2D map;
uniform vec4 uvT; // rx, ry, ox, oy
uniform float aspect;
uniform vec4 ripples[${MAX_RIPPLES}]; // x, y(0~1, y 向下), age, strength
uniform float time;
varying vec2 vUv;
void main() {
  vec2 suv = vec2(vUv.x, 1.0 - vUv.y);
  vec2 off = vec2(0.0);
  float shine = 0.0;
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 r = ripples[i];
    if (r.w <= 0.0) continue;
    vec2 d = suv - r.xy;
    d.x *= aspect;
    float dd = length(d);
    float radius = r.z * 0.45;
    float band = exp(-pow((dd - radius) * 14.0, 2.0));
    float wave = sin(dd * 70.0 - r.z * 14.0) * band * exp(-r.z * 1.6) * r.w;
    vec2 dir = dd > 0.0001 ? d / dd : vec2(0.0);
    dir.x /= aspect;
    off += dir * wave * 0.03;
    shine += wave;
  }
  vec2 s = suv + off;
  vec2 vuv = vec2(s.x * uvT.x + uvT.z, s.y * uvT.y + uvT.w);
  float ca = length(off) * 0.6;
  vec3 col;
  col.r = texture2D(map, vec2(vuv.x + ca, 1.0 - vuv.y)).r;
  col.g = texture2D(map, vec2(vuv.x, 1.0 - vuv.y)).g;
  col.b = texture2D(map, vec2(vuv.x - ca, 1.0 - vuv.y)).b;
  col += vec3(0.6, 0.85, 1.0) * max(shine, 0.0) * 0.35;
  gl_FragColor = vec4(col, 1.0);
}`;

interface Star {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  rot: number;
  hue: number;
}

interface Stroke {
  pts: { x: number; y: number }[];
  done: boolean;
  heart?: { cx: number; cy: number; s: number; t: number };
  age: number;
}

function heartPts(cx: number, cy: number, s: number, n = 90) {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    out.push({ x: cx + (x / 17) * s, y: cy - (y / 17) * s });
  }
  return out;
}

export function create(ctx: SceneContext): SceneInstance {
  let w = ctx.width, h = ctx.height;
  const st = createThreeStage(ctx.root, w, h, { alpha: false, dprCap: 1.5 });
  const fx = canvas2d(ctx.root, w, h);
  st.renderer.setClearColor(0x000000, 1);

  // 背景：视频（或海报）+ 水波着色器
  let poster = new THREE.CanvasTexture(posterCanvas(w, h, '心'));
  poster.colorSpace = THREE.SRGBColorSpace;
  let videoTex: THREE.VideoTexture | null = null;
  const ripples = Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, 0, 0));
  const uniforms = {
    map: { value: poster as THREE.Texture },
    uvT: { value: new THREE.Vector4(1, 1, 0, 0) },
    aspect: { value: w / h },
    ripples: { value: ripples },
    time: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: frag,
    depthTest: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  st.scene.add(quad);
  let rippleIdx = 0;
  const addRipple = (x: number, y: number, s = 1) => {
    ripples[rippleIdx].set(x / w, y / h, 0, s);
    rippleIdx = (rippleIdx + 1) % MAX_RIPPLES;
  };

  const strokes: Stroke[] = [];
  const stars: Star[] = [];
  let flash = 0;
  let drawId = -1;
  let time = 0;
  let rippleMode = false;
  let lastRipple = 0;
  const gestureHist = new Map<number, { g: string; t: number }[]>();
  // 催眠
  let hypno = 0; // 0~1 进度（变黑程度）
  let stillT = 0;
  let hypnoOn = false;
  let hypnoForced = false;
  let pendAnchor = { x: w / 2, y: h * 0.3 };
  let drone: ReturnType<typeof ctx.audio.drone> = null;
  let lastBurst = -10;

  const burst = (x: number, y: number) => {
    if (time - lastBurst < 0.6) return;
    lastBurst = time;
    flash = 0.75;
    ctx.audio.burst();
    for (let i = 0; i < 140; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(120, 720);
      stars.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: 0, max: rand(0.9, 2.0), size: rand(4, 11), rot: rand(0, 6), hue: rand(38, 52) });
    }
    // 画好的心也化作星星
    for (const s of strokes) {
      const pts = s.heart ? heartPts(s.heart.cx, s.heart.cy, s.heart.s, 50) : s.pts.filter((_, i) => i % 3 === 0);
      for (const p of pts) {
        const a = Math.atan2(p.y - y, p.x - x) + rand(-0.5, 0.5);
        const sp = rand(60, 260);
        stars.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: rand(0.8, 1.6), size: rand(3, 8), rot: 0, hue: rand(320, 345) });
      }
    }
    strokes.length = 0;
    addRipple(x, y, 1.4);
  };

  const finishStroke = (s: Stroke) => {
    s.done = true;
    const pts = s.pts;
    if (pts.length < 8) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, len = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
      if (i) len += dist(p, pts[i - 1]);
    }
    const diag = Math.hypot(maxX - minX, maxY - minY);
    const closed = dist(pts[0], pts[pts.length - 1]) < diag * 0.3;
    if (closed && diag > 80 && len > diag * 1.8) {
      s.heart = { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, s: Math.max(maxX - minX, maxY - minY) * 0.55, t: 0 };
      ctx.audio.success();
      for (let i = 0; i < 24; i++) {
        const a = rand(0, Math.PI * 2);
        stars.push({ x: s.heart.cx + Math.cos(a) * s.heart.s, y: s.heart.cy + Math.sin(a) * s.heart.s, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, life: 0, max: 1, size: 5, rot: 0, hue: 330 });
      }
    }
  };

  const ui = {
    burst: button(ctx, '✋ 星爆', () => burst(w / 2, h / 2), { title: '星星爆发' }),
    ripple: button(ctx, '〰 水波', () => {
      rippleMode = !rippleMode;
      ui.ripple.classList.toggle('on', rippleMode);
      ctx.toast(rippleMode ? '水波模式：拖动手指搅动画面' : '画心模式：拖动手指画心');
    }),
    hypno: button(ctx, '🌀 催眠', () => {
      hypnoForced = !hypnoForced;
      ui.hypno.classList.toggle('on', hypnoForced);
    }),
  };

  const drawStarShape = (g: CanvasRenderingContext2D, s: number) => {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? s * 0.42 : s;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  };

  const neon = (g: CanvasRenderingContext2D, pts: { x: number; y: number }[], alpha: number, wd = 5) => {
    if (pts.length < 2) return;
    g.save();
    g.globalAlpha = alpha;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
      g.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    g.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    g.shadowColor = '#ff2d95';
    g.shadowBlur = 28;
    g.strokeStyle = 'rgba(255,60,160,0.85)';
    g.lineWidth = wd * 2.2;
    g.stroke();
    g.shadowBlur = 10;
    g.strokeStyle = '#ffd1ea';
    g.lineWidth = wd * 0.7;
    g.stroke();
    g.restore();
  };

  const detectOpenBurst = (hd: Hand) => {
    let hist = gestureHist.get(hd.id);
    if (!hist) gestureHist.set(hd.id, (hist = []));
    hist.push({ g: hd.gesture, t: time });
    while (hist.length && time - hist[0].t > 0.7) hist.shift();
    if (hd.gesture === 'open') {
      const before = hist.slice(0, -2);
      if (before.some((x) => x.g === 'pinch' || x.g === 'fist') && hist.slice(-2).every((x) => x.g === 'open')) {
        hist.length = 0;
        burst(hd.palm.x, hd.palm.y);
      }
    }
  };

  return {
    update(f: InputFrame) {
      const dt = f.dt;
      time += dt;
      uniforms.time.value = time;
      // 背景纹理
      if (ctx.hasVideo()) {
        if (!videoTex) {
          videoTex = new THREE.VideoTexture(ctx.video);
          videoTex.colorSpace = THREE.SRGBColorSpace;
          uniforms.map.value = videoTex;
        }
        const cm = ctx.cover();
        if (cm) {
          const u = coverUv(cm);
          uniforms.uvT.value.set(u.rx, u.ry, u.ox, u.oy);
        }
      } else {
        uniforms.uvT.value.set(1, 1, 0, 0);
      }
      for (const r of ripples) {
        if (r.w > 0) {
          r.z += dt;
          if (r.z > 2.5) r.w = 0;
        }
      }

      // ---- 画心 ----
      for (const s of f.pinchStarted) {
        if (drawId === -1 && !rippleMode) {
          drawId = s.id;
          strokes.push({ pts: [{ ...s.pinchPt }], done: false, age: 0 });
          if (strokes.length > 6) strokes.shift();
        }
      }
      const cur = f.hands.find((x) => x.id === drawId && x.pinching);
      const active = strokes.find((s) => !s.done);
      if (cur && active) {
        const lp = active.pts[active.pts.length - 1];
        if (dist(lp, cur.pinchPt) > 4) active.pts.push({ ...cur.pinchPt });
      }
      if (drawId !== -1 && (!cur || f.pinchEnded.some((x) => x.id === drawId))) {
        if (active) finishStroke(active);
        drawId = -1;
      }

      // ---- 张手星爆 / 挥手水波 / 平掌催眠 ----
      let still: Hand | null = null;
      for (const hd of f.hands) {
        if (hd.source === 'camera') {
          detectOpenBurst(hd);
          const sp = Math.hypot(hd.vel.x, hd.vel.y);
          if (hd.gesture === 'open' && sp > 380 && time - lastRipple > 0.07) {
            addRipple(hd.palm.x, hd.palm.y, clamp(sp / 1200, 0.5, 1.3));
            lastRipple = time;
          }
          if (hd.gesture === 'open' && hd.palmFlat && sp < 160) still = hd;
        } else if (rippleMode && hd.pinching) {
          const sp = Math.hypot(hd.vel.x, hd.vel.y);
          if (time - lastRipple > 0.06 && (sp > 120 || f.pinchStarted.includes(hd))) {
            addRipple(hd.palm.x, hd.palm.y, clamp(sp / 900, 0.6, 1.3));
            lastRipple = time;
          }
        }
      }
      if (still) {
        stillT += dt;
        pendAnchor = { x: still.lm ? still.lm[0].x : still.palm.x, y: still.lm ? still.lm[0].y : still.palm.y };
      } else stillT = Math.max(0, stillT - dt * 2);
      const wantHypno = hypnoForced || stillT > 1.0;
      if (wantHypno && !hypnoOn) {
        hypnoOn = true;
        drone = ctx.audio.drone(98);
        if (hypnoForced) pendAnchor = { x: w / 2, y: h * 0.28 };
      } else if (!wantHypno && hypnoOn && stillT <= 0.3) {
        hypnoOn = false;
        drone?.stop();
        drone = null;
      }
      hypno = clamp(hypno + (hypnoOn ? dt / 5 : -dt * 1.5), 0, 1);
      drone?.set(hypno);

      st.render();

      // ---- 2D 叠加层 ----
      fx.clear();
      const g = fx.ctx;
      g.globalCompositeOperation = 'lighter';
      for (const s of strokes) {
        s.age += dt;
        if (s.heart) {
          s.heart.t += dt;
          const beat = 1 + 0.08 * Math.max(0, Math.sin(time * 7)) * Math.max(0, Math.sin(time * 3.5));
          const grow = Math.min(1, s.heart.t * 3);
          if (grow < 1) neon(g, s.pts, 1 - grow);
          neon(g, heartPts(s.heart.cx, s.heart.cy, s.heart.s * beat * (0.85 + 0.15 * grow)), grow, 6);
        } else neon(g, s.pts, s.done ? Math.max(0.35, 1 - s.age * 0.03) : 1);
      }
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];
        s.life += dt;
        if (s.life > s.max) {
          stars.splice(i, 1);
          continue;
        }
        s.vx *= 1 - 1.4 * dt;
        s.vy = s.vy * (1 - 1.4 * dt) + 160 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.rot += dt * 3;
        const a = 1 - s.life / s.max;
        g.save();
        g.translate(s.x, s.y);
        g.rotate(s.rot);
        g.globalAlpha = a * (0.7 + 0.3 * Math.sin(time * 30 + i));
        g.fillStyle = `hsl(${s.hue}, 100%, ${65 + 20 * a}%)`;
        g.shadowColor = `hsl(${s.hue}, 100%, 60%)`;
        g.shadowBlur = 12;
        drawStarShape(g, s.size * (0.6 + 0.4 * a));
        g.restore();
      }
      g.globalCompositeOperation = 'source-over';
      if (flash > 0) {
        g.fillStyle = `rgba(255,248,225,${flash})`;
        g.fillRect(0, 0, w, h);
        flash = Math.max(0, flash - dt * 3);
      }
      // 催眠：变黑 + 摆锤 + zZZ
      if (hypno > 0) {
        g.fillStyle = `rgba(0,0,0,${hypno * 0.94})`;
        g.fillRect(0, 0, w, h);
        const vis = Math.min(1, hypno * 3);
        const L = Math.min(w, h) * 0.32;
        const ang = Math.sin(time * 2.2) * 0.55;
        const ax = pendAnchor.x, ay = pendAnchor.y;
        const bx = ax + Math.sin(ang) * L, by = ay + Math.cos(ang) * L;
        g.save();
        g.globalAlpha = vis;
        g.strokeStyle = 'rgba(216,180,106,0.9)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(ax, ay);
        g.lineTo(bx, by);
        g.stroke();
        // 摆锤：玉璧
        const R = Math.max(18, L * 0.12);
        const grad = g.createRadialGradient(bx - R * 0.3, by - R * 0.3, R * 0.1, bx, by, R);
        grad.addColorStop(0, '#d9fff0');
        grad.addColorStop(0.5, '#5fe3b0');
        grad.addColorStop(1, '#1a6b52');
        g.fillStyle = grad;
        g.shadowColor = '#5fe3b0';
        g.shadowBlur = 30;
        g.beginPath();
        g.arc(bx, by, R, 0, Math.PI * 2);
        g.arc(bx, by, R * 0.35, 0, Math.PI * 2, true);
        g.fill('evenodd');
        g.shadowBlur = 0;
        // 拖影
        for (let k = 1; k < 5; k++) {
          const a2 = Math.sin((time - k * 0.05) * 2.2) * 0.55;
          g.globalAlpha = vis * (0.18 - k * 0.03);
          g.beginPath();
          g.arc(ax + Math.sin(a2) * L, ay + Math.cos(a2) * L, R, 0, Math.PI * 2);
          g.fillStyle = '#5fe3b0';
          g.fill();
        }
        // zZZ
        g.globalAlpha = vis;
        g.fillStyle = '#eaf2ff';
        g.textAlign = 'left';
        for (let k = 0; k < 3; k++) {
          const ph = (time * 0.6 + k / 3) % 1;
          g.globalAlpha = vis * Math.sin(ph * Math.PI);
          g.font = `700 ${20 + k * 10}px ${FONT}`;
          g.shadowColor = '#9fc0ff';
          g.shadowBlur = 12;
          g.fillText(k === 0 ? 'z' : 'Z', ax + R * 1.4 + k * 18 + ph * 24, ay + L * 0.45 - ph * 60 - k * 18);
        }
        g.globalAlpha = vis * 0.8;
        g.font = `500 14px ${FONT}`;
        g.textAlign = 'center';
        g.fillStyle = 'rgba(216,180,106,0.9)';
        g.fillText('放松……动一动手就会醒来', w / 2, h - 150);
        g.restore();
      }
    },
    resize(nw, nh) {
      w = nw;
      h = nh;
      st.resize(w, h);
      fx.resize(w, h);
      uniforms.aspect.value = w / h;
      poster.dispose();
      poster = new THREE.CanvasTexture(posterCanvas(w, h, '心'));
      poster.colorSpace = THREE.SRGBColorSpace;
      if (!videoTex) uniforms.map.value = poster;
    },
    dispose() {
      drone?.stop();
      poster.dispose();
      videoTex?.dispose();
      st.dispose();
      fx.dispose();
    },
  };
}

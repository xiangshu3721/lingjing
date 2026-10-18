/**
 * 黑胶唱片机：捏住唱臂放到唱片上 → 播放；手指在唱片上画圈 → 搓碟变速；
 * 张开手掌 → 暂停（刹车）；左右挥手 → 换唱片；也可以选手机里的音乐文件（只在本机播放）。
 */
import { SwipeDetector } from '../../engine/gestures';
import type { InputFrame } from '../../engine/types';
import { button, canvas2d, clamp, dist, FONT, lerp, SERIF } from '../kit';
import type { SceneContext, SceneInstance } from '../types';
import { TRACKS } from './music';

interface Disc {
  title: string;
  sub: string;
  color: string;
  buffer: AudioBuffer | null;
  loading: boolean;
  render?: (sr: number) => Promise<AudioBuffer>;
}

export function create(ctx: SceneContext): SceneInstance {
  let w = ctx.width, h = ctx.height;
  const c = canvas2d(ctx.root, w, h);
  const discs: Disc[] = TRACKS.map((t) => ({ title: t.title, sub: t.sub, color: t.color, buffer: null, loading: false, render: t.render }));
  let di = 0;
  // 唱臂角度：rest（停在架子上）→ 0.38~0.75 在唱片上
  const ARM_REST = 0.05, ARM_START = 0.36, ARM_END = 0.72;
  let arm = ARM_REST;
  let armHeld = -1;
  let rot = 0; // 唱片旋转角
  let speed = 0; // 实际转速倍数（1 = 正常）
  let paused = false;
  let scratchW: number | null = null; // 搓碟时手给的角速度
  let lastAng: number | null = null;
  let src: AudioBufferSourceNode | null = null;
  let srcGain: GainNode | null = null;
  let analyser: AnalyserNode | null = null;
  let freq: Uint8Array<ArrayBuffer> | null = null;
  let offset = 0; // 播放位置（秒）
  let time = 0;
  let level = 0;
  const swipe = new SwipeDetector(0.22, 450, 900);
  let openT = 0;
  let disposed = false;
  let lastPlaybackRate = 1;

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'audio/*';
  fileInput.style.display = 'none';
  ctx.ui.appendChild(fileInput);
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    ctx.audio.unlock();
    const ac = ctx.audio.ctx;
    if (!ac) return;
    const disc: Disc = { title: file.name.replace(/\.[^.]+$/, '').slice(0, 18), sub: '本地音乐 · 只在本机播放', color: '#ff9ccc', buffer: null, loading: true };
    discs.push(disc);
    switchTo(discs.length - 1);
    try {
      disc.buffer = await ac.decodeAudioData(await file.arrayBuffer());
      disc.loading = false;
      ctx.toast('已放上你的唱片');
    } catch {
      disc.loading = false;
      discs.pop();
      switchTo(0);
      ctx.toast('这个文件放不了，换一首试试');
    }
    fileInput.value = '';
  });

  button(ctx, '◀ 上一张', () => switchTo((di - 1 + discs.length) % discs.length));
  button(ctx, '下一张 ▶', () => switchTo((di + 1) % discs.length));
  const playBtn = button(ctx, '▶ 播放', () => {
    if (arm < ARM_START) {
      arm = ARM_START + 0.02;
      paused = false;
      startPlay();
    } else {
      paused = !paused;
    }
  });
  button(ctx, '♪ 本地音乐', () => fileInput.click(), { title: '从设备选择音乐文件' });

  const ensureBuffer = async (d: Disc) => {
    if (d.buffer || d.loading || !d.render) return;
    const ac = ctx.audio.ctx;
    if (!ac) return;
    d.loading = true;
    try {
      d.buffer = await d.render(ac.sampleRate);
    } catch (e) {
      console.warn('生成音乐失败', e);
    }
    d.loading = false;
    if (!disposed && discs[di] === d && arm >= ARM_START) startPlay();
  };

  const stopSrc = () => {
    if (src) {
      try {
        src.stop();
      } catch {
        /* ignore */
      }
      src.disconnect();
      src = null;
    }
  };

  const startPlay = () => {
    ctx.audio.unlock();
    const ac = ctx.audio.ctx;
    const d = discs[di];
    if (!ac || !ctx.audio.out) return;
    if (!d.buffer) {
      void ensureBuffer(d);
      return;
    }
    stopSrc();
    if (!analyser) {
      analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      freq = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      srcGain = ac.createGain();
      srcGain.connect(analyser);
      analyser.connect(ctx.audio.out);
    }
    src = ac.createBufferSource();
    src.buffer = d.buffer;
    src.loop = true;
    src.playbackRate.value = Math.max(0.01, speed);
    src.connect(srcGain!);
    src.start(0, offset % d.buffer.duration);
    // 落针声
    ctx.audio.noiseHit({ gain: 0.18, decay: 0.08, freq: 2500 });
  };

  const switchTo = (i: number) => {
    di = i;
    offset = 0;
    stopSrc();
    ctx.audio.whoosh(true, 0.1);
    const d = discs[di];
    if (arm >= ARM_START) {
      if (d.buffer) startPlay();
      else void ensureBuffer(d);
    }
  };

  const geo = () => {
    const R = Math.min(w * 0.4, h * 0.27);
    const cx = w / 2 - R * 0.12, cy = h * 0.46;
    const pivot = { x: cx + R * 1.12, y: cy - R * 0.95 };
    const armLen = R * 1.55;
    return { R, cx, cy, pivot, armLen };
  };
  const armHead = (a: number) => {
    const { pivot, armLen } = geo();
    // a=0 竖直向下；正值向唱片（左）摆
    const ang = Math.PI / 2 + 0.15 + a;
    return { x: pivot.x + Math.cos(ang) * armLen, y: pivot.y + Math.sin(ang) * armLen };
  };

  // 进场就开始在后台合成第一张，放上唱臂即可播放
  setTimeout(() => !disposed && void ensureBuffer(discs[0]), 60);

  return {
    update(f: InputFrame) {
      const dt = f.dt;
      time += dt;
      const { R, cx, cy, pivot } = geo();
      const d = discs[di];
      // ---- 唱臂：捏住唱头拖动 ----
      for (const p of f.pinchStarted) {
        if (dist(p.pinchPt, armHead(arm)) < Math.max(44, R * 0.22)) {
          armHeld = p.id;
          ctx.audio.unlock();
        }
      }
      const holder = f.hands.find((x) => x.id === armHeld && x.pinching);
      if (holder) {
        const a = Math.atan2(holder.pinchPt.y - pivot.y, holder.pinchPt.x - pivot.x) - Math.PI / 2 - 0.15;
        arm = clamp(a, 0, ARM_END + 0.05);
      } else if (armHeld !== -1) {
        armHeld = -1;
        if (arm >= ARM_START - 0.04 && arm <= ARM_END + 0.05) {
          arm = Math.max(arm, ARM_START);
          paused = false;
          startPlay();
        } else {
          arm = ARM_REST;
          stopSrc();
        }
      }
      const onRecord = arm >= ARM_START && armHeld === -1;
      // ---- 搓碟：手指/捏合点在唱片上画圈 ----
      scratchW = null;
      const scratcher = f.hands.find((x) => {
        if (x.id === armHeld) return false;
        const p = x.source === 'camera' ? x.tip : x.pinchPt;
        const r = dist(p, { x: cx, y: cy });
        return r > R * 0.25 && r < R * 1.05 && (x.source === 'touch' ? x.pinching : x.gesture === 'point' || x.gesture === 'pinch');
      });
      if (scratcher) {
        const p = scratcher.source === 'camera' ? scratcher.tip : scratcher.pinchPt;
        const ang = Math.atan2(p.y - cy, p.x - cx);
        if (lastAng !== null) {
          let da = ang - lastAng;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          scratchW = da / Math.max(dt, 1 / 120);
        }
        lastAng = ang;
      } else lastAng = null;
      // ---- 张开手掌：暂停 ----
      const palm = f.hands.find((x) => x.source === 'camera' && x.gesture === 'open');
      if (palm && Math.hypot(palm.vel.x, palm.vel.y) < 300) {
        openT += dt;
        if (openT > 0.5 && !paused && onRecord) {
          paused = true;
          ctx.toast('暂停');
        }
      } else {
        if (openT > 0.5 && paused && palm === undefined) {
          /* 放下手不自动恢复，等捏合或按钮 */
        }
        openT = 0;
      }
      // 暂停后再捏一下唱片 → 继续
      for (const p of f.pinchStarted) if (paused && dist(p.pinchPt, { x: cx, y: cy }) < R && p.id !== armHeld) paused = false;
      // ---- 挥手换唱片 ----
      for (const hd of f.hands) if (hd.source === 'camera' && hd.gesture === 'open' && swipe.push(hd.palm.x, hd.palm.y, f.t, w)) switchTo((di + (hd.vel.x > 0 ? 1 : -1) + discs.length) % discs.length);

      // ---- 转速 ----
      const BASE = (33.3 / 60) * Math.PI * 2; // 33⅓ 转/分 → 弧度/秒
      let target = onRecord && !paused && d.buffer ? 1 : 0;
      if (scratchW !== null && onRecord) target = scratchW / BASE;
      speed = scratchW !== null ? lerp(speed, target, 0.5) : lerp(speed, target, Math.min(1, dt * (target > speed ? 2.5 : 1.8)));
      rot += speed * BASE * dt;
      if (src && d.buffer) {
        const rate = clamp(Math.abs(speed), 0.02, 3);
        if (Math.abs(rate - lastPlaybackRate) > 0.01) {
          src.playbackRate.setTargetAtTime(rate, ctx.audio.ctx!.currentTime, 0.03);
          lastPlaybackRate = rate;
        }
        srcGain!.gain.setTargetAtTime(Math.abs(speed) < 0.05 ? 0 : speed < 0 ? 0.5 : 1, ctx.audio.ctx!.currentTime, 0.03);
        offset += dt * rate;
      }
      if (!onRecord && src) stopSrc();
      playBtn.textContent = !onRecord ? '▶ 播放' : paused ? '▶ 继续' : '❚❚ 暂停';
      // 音频能量
      let e = 0;
      if (analyser && freq && src) {
        analyser.getByteFrequencyData(freq);
        for (let i = 0; i < freq.length; i++) e += freq[i];
        e /= freq.length * 255;
      }
      level = lerp(level, e, 0.3);

      // ---- 绘制 ----
      c.clear();
      const g = c.ctx;
      g.fillStyle = 'rgba(8,7,6,0.7)';
      g.fillRect(0, 0, w, h);
      // 音频反应光晕
      const glow = g.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * (1.5 + level * 1.2));
      glow.addColorStop(0, `${d.color}55`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);
      // 底座
      g.fillStyle = '#2a1c12';
      g.beginPath();
      g.roundRect(cx - R * 1.3, cy - R * 1.25, R * 2.85, R * 2.5, R * 0.12);
      g.fill();
      g.strokeStyle = 'rgba(216,180,106,0.35)';
      g.lineWidth = 1.5;
      g.stroke();
      // 频谱环
      if (freq && src) {
        const n = 48;
        for (let i = 0; i < n; i++) {
          const v = freq[Math.floor((i / n) * freq.length * 0.7)] / 255;
          const a = (i / n) * Math.PI * 2 + rot * 0.2;
          const r1 = R * 1.05, r2 = r1 + v * R * 0.18;
          g.strokeStyle = `${d.color}`;
          g.globalAlpha = 0.3 + v * 0.7;
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
          g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
          g.stroke();
        }
        g.globalAlpha = 1;
      }
      // 唱片
      g.save();
      g.translate(cx, cy);
      g.rotate(rot);
      g.beginPath();
      g.arc(0, 0, R, 0, Math.PI * 2);
      g.fillStyle = '#0c0c0e';
      g.fill();
      for (let k = 0; k < 26; k++) {
        g.beginPath();
        g.arc(0, 0, R * (0.38 + k * 0.023), 0, Math.PI * 2);
        g.strokeStyle = k % 3 ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.07)';
        g.lineWidth = 1;
        g.stroke();
      }
      // 沟槽反光
      g.globalCompositeOperation = 'lighter';
      for (const off of [0, Math.PI]) {
        g.beginPath();
        g.moveTo(0, 0);
        g.arc(0, 0, R * 0.98, off - rot - 0.35, off - rot + 0.35);
        g.closePath();
        const sh = g.createRadialGradient(0, 0, R * 0.36, 0, 0, R);
        sh.addColorStop(0, 'rgba(255,255,255,0)');
        sh.addColorStop(0.7, `rgba(255,255,255,${0.06 + level * 0.15})`);
        sh.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = sh;
        g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      // 唱片标签
      g.beginPath();
      g.arc(0, 0, R * 0.33, 0, Math.PI * 2);
      g.fillStyle = d.color;
      g.fill();
      g.fillStyle = '#1a1208';
      g.textAlign = 'center';
      g.font = `700 ${R * 0.085}px ${SERIF}`;
      g.fillText(d.title, 0, -R * 0.06);
      g.font = `${R * 0.055}px ${FONT}`;
      g.fillText(d.loading ? '正在合成…' : d.sub, 0, R * 0.08);
      g.beginPath();
      g.arc(0, 0, R * 0.025, 0, Math.PI * 2);
      g.fillStyle = '#ddd';
      g.fill();
      g.restore();
      // 唱臂
      const head = armHead(arm);
      g.strokeStyle = '#c9c4ba';
      g.lineWidth = Math.max(4, R * 0.035);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(pivot.x, pivot.y);
      g.lineTo(head.x, head.y);
      g.stroke();
      g.beginPath();
      g.arc(pivot.x, pivot.y, R * 0.1, 0, Math.PI * 2);
      g.fillStyle = '#6b655c';
      g.fill();
      g.save();
      g.translate(head.x, head.y);
      g.rotate(Math.atan2(head.y - pivot.y, head.x - pivot.x));
      g.fillStyle = armHeld !== -1 ? '#5fe3b0' : '#e8e2d6';
      g.fillRect(-R * 0.04, -R * 0.05, R * 0.12, R * 0.1);
      g.restore();
      if (arm < ARM_START && armHeld === -1) {
        g.beginPath();
        g.arc(head.x, head.y, Math.max(26, R * 0.16) + Math.sin(time * 4) * 3, 0, Math.PI * 2);
        g.strokeStyle = 'rgba(95,227,176,0.6)';
        g.lineWidth = 1.5;
        g.stroke();
        g.font = `13px ${FONT}`;
        g.fillStyle = 'rgba(236,231,220,0.85)';
        g.textAlign = 'center';
        g.fillText('捏住唱头 → 放到唱片上', Math.min(head.x, w - 90), head.y + Math.max(42, R * 0.25));
      }
      if (scratchW !== null && onRecord) {
        g.font = `600 14px ${FONT}`;
        g.fillStyle = d.color;
        g.textAlign = 'center';
        g.fillText(`搓碟 ×${Math.abs(speed).toFixed(1)}`, cx, cy + R * 1.35);
      }
    },
    resize(nw, nh) {
      w = nw;
      h = nh;
      c.resize(w, h);
    },
    dispose() {
      disposed = true;
      stopSrc();
      try {
        analyser?.disconnect();
        srcGain?.disconnect();
      } catch {
        /* ignore */
      }
      c.dispose();
    },
  };
}

/**
 * 复古录音机：麦克风录音（MediaRecorder），磁带轮转动、VU 表跳动；
 * 播放 / 倒带 / 快进（按住）/ 变声（花栗鼠、低沉、回声、机器人）/ 下载。全部只在本机。
 */
import type { InputFrame } from '../../engine/types';
import { button, canvas2d, clamp, FONT, lerp, SERIF } from '../kit';
import type { SceneContext, SceneInstance } from '../types';
import { encodeWav } from './wav';

type Fx = 'none' | 'chipmunk' | 'deep' | 'echo' | 'robot';
const FX: { k: Fx; name: string; rate: number }[] = [
  { k: 'none', name: '原声', rate: 1 },
  { k: 'chipmunk', name: '花栗鼠', rate: 1.6 },
  { k: 'deep', name: '低沉', rate: 0.72 },
  { k: 'echo', name: '回声', rate: 1 },
  { k: 'robot', name: '机器人', rate: 1 },
];
type Mode = 'idle' | 'rec' | 'play' | 'ff' | 'rew';

function pickMime() {
  const cands = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg'];
  for (const m of cands) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)) return m;
  return '';
}

/** 把效果链接到 dest，返回输入节点 */
function buildFx(c: BaseAudioContext, fx: Fx, dest: AudioNode): { input: AudioNode; stop: () => void } {
  if (fx === 'echo') {
    const input = c.createGain();
    const delay = c.createDelay(1);
    delay.delayTime.value = 0.28;
    const fb = c.createGain();
    fb.gain.value = 0.42;
    input.connect(dest);
    input.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(dest);
    return { input, stop: () => {} };
  }
  if (fx === 'robot') {
    const input = c.createGain();
    const ring = c.createGain();
    ring.gain.value = 0;
    const o = c.createOscillator();
    o.frequency.value = 55;
    o.connect(ring.gain);
    o.start();
    const hp = c.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 1200;
    hp.Q.value = 0.7;
    input.connect(ring).connect(hp).connect(dest);
    return { input, stop: () => o.stop() };
  }
  return { input: dest, stop: () => {} };
}

export function create(ctx: SceneContext): SceneInstance {
  let w = ctx.width, h = ctx.height;
  const c = canvas2d(ctx.root, w, h);
  let mode: Mode = 'idle';
  let fx = 0;
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let blob: Blob | null = null;
  let buffer: AudioBuffer | null = null;
  let pos = 0; // 播放头（秒）
  let recT = 0;
  let src: AudioBufferSourceNode | null = null;
  let fxChain: { input: AudioNode; stop: () => void } | null = null;
  let micAnalyser: AnalyserNode | null = null;
  let outAnalyser: AnalyserNode | null = null;
  const buf8 = new Uint8Array(new ArrayBuffer(512));
  let vu = 0;
  let reelA = 0, reelB = 0;
  let disposed = false;
  let rewNoise: ReturnType<typeof ctx.audio.waterVoice> = null;
  const isSecure = window.isSecureContext !== false;

  const setMode = (m: Mode) => {
    mode = m;
    refresh();
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
    fxChain?.stop();
    fxChain = null;
  };

  const startRec = async () => {
    ctx.audio.unlock();
    stopSrc();
    if (!isSecure || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      ctx.toast('这个浏览器不支持录音');
      ctx.setHint('这个浏览器不支持录音，换最新版 Safari / Chrome 试试');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    } catch (e) {
      const name = (e as { name?: string })?.name;
      ctx.setHint(name === 'NotAllowedError' || name === 'SecurityError' ? '没有拿到麦克风权限。可以在浏览器地址栏的「锁」图标里允许麦克风，再点「录音」。' : '没找到可用的麦克风，或者正被别的应用占用。');
      ctx.toast('麦克风没打开');
      return;
    }
    if (disposed) return;
    const ac = ctx.audio.ctx!;
    const ms = ac.createMediaStreamSource(stream);
    micAnalyser = ac.createAnalyser();
    micAnalyser.fftSize = 512;
    ms.connect(micAnalyser);
    const mime = pickMime();
    recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    chunks = [];
    recorder.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
    recorder.onstop = async () => {
      blob = new Blob(chunks, { type: recorder?.mimeType || mime || 'audio/webm' });
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      micAnalyser = null;
      try {
        buffer = await ctx.audio.ctx!.decodeAudioData(await blob.arrayBuffer());
        pos = 0;
        ctx.toast(`录好了 ${buffer.duration.toFixed(1)} 秒`);
      } catch {
        ctx.toast('录音解码失败，可以直接下载原始文件');
      }
      refresh();
    };
    recorder.start(250);
    recT = 0;
    setMode('rec');
    ctx.audio.tone(880, { gain: 0.08, decay: 0.1 });
  };

  const stopAll = () => {
    if (mode === 'rec' && recorder && recorder.state !== 'inactive') recorder.stop();
    stopSrc();
    rewNoise?.set(0);
    setMode('idle');
    ctx.audio.noiseHit({ gain: 0.15, decay: 0.05, freq: 1200 });
  };

  const play = (rateMul = 1) => {
    if (!buffer) {
      ctx.toast('先录一段吧');
      return;
    }
    ctx.audio.unlock();
    stopSrc();
    const ac = ctx.audio.ctx!;
    if (!outAnalyser) {
      outAnalyser = ac.createAnalyser();
      outAnalyser.fftSize = 512;
      outAnalyser.connect(ctx.audio.out!);
    }
    if (pos >= buffer.duration - 0.05) pos = 0;
    fxChain = buildFx(ac, FX[fx].k, outAnalyser);
    src = ac.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = FX[fx].rate * rateMul;
    src.connect(fxChain.input);
    src.onended = () => {
      if (src && mode !== 'idle' && mode !== 'rew') {
        stopSrc();
        setMode('idle');
      }
    };
    src.start(0, pos);
    setMode(rateMul > 1 ? 'ff' : 'play');
  };

  const download = async () => {
    if (!blob) {
      ctx.toast('还没有录音');
      return;
    }
    let out: Blob = blob;
    let ext = (blob.type.includes('mp4') || blob.type.includes('aac') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm');
    if (buffer && FX[fx].k !== 'none') {
      // 离线渲染变声版
      const rate = FX[fx].rate;
      const dur = buffer.duration / rate + (FX[fx].k === 'echo' ? 1.5 : 0.1);
      const oc = new OfflineAudioContext(1, Math.ceil(dur * buffer.sampleRate), buffer.sampleRate);
      const chain = buildFx(oc, FX[fx].k, oc.destination);
      const s = oc.createBufferSource();
      s.buffer = buffer;
      s.playbackRate.value = rate;
      s.connect(chain.input);
      s.start();
      out = encodeWav(await oc.startRendering());
      ext = 'wav';
    }
    const url = URL.createObjectURL(out);
    const a = document.createElement('a');
    a.href = url;
    a.download = `灵境录音-${FX[fx].name}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    ctx.toast('已保存到本机（iOS 可能在新页面打开，点分享存储）');
  };

  const btn = {
    rec: button(ctx, '● 录音', () => (mode === 'rec' ? stopAll() : startRec())),
    play: button(ctx, '▶ 播放', () => (mode === 'play' ? stopAll() : play())),
    rew: button(ctx, '◀◀ 倒带', () => {}),
    ff: button(ctx, '▶▶ 快进', () => {}),
    stop: button(ctx, '■ 停止', stopAll),
    fx: button(ctx, `变声：${FX[0].name}`, () => {
      fx = (fx + 1) % FX.length;
      refresh();
      if (mode === 'play') play();
    }),
    dl: button(ctx, '⤓ 下载', () => void download()),
  };
  // 按住倒带/快进
  const hold = (el: HTMLElement, m: 'rew' | 'ff') => {
    const down = (e: Event) => {
      e.preventDefault();
      ctx.audio.unlock();
      if (!buffer) return ctx.toast('先录一段吧');
      if (m === 'ff') play(3);
      else {
        stopSrc();
        setMode('rew');
        if (!rewNoise && ctx.audio.ready) rewNoise = ctx.audio.waterVoice();
      }
    };
    const up = () => {
      if (mode === m) {
        if (m === 'ff') {
          stopSrc();
          setMode('idle');
        } else {
          rewNoise?.set(0);
          setMode('idle');
        }
      }
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('pointercancel', up);
  };
  hold(btn.rew, 'rew');
  hold(btn.ff, 'ff');

  const refresh = () => {
    btn.rec.textContent = mode === 'rec' ? '■ 停止录音' : '● 录音';
    btn.rec.classList.toggle('on', mode === 'rec');
    btn.play.textContent = mode === 'play' ? '❚❚ 暂停' : '▶ 播放';
    btn.play.classList.toggle('on', mode === 'play');
    btn.fx.textContent = `变声：${FX[fx].name}`;
    btn.rew.classList.toggle('on', mode === 'rew');
    btn.ff.classList.toggle('on', mode === 'ff');
    (btn.dl as HTMLButtonElement).disabled = !blob;
  };
  refresh();

  return {
    update(f: InputFrame) {
      const dt = f.dt;
      // 点击磁带区域 = 播放/暂停
      for (const p of f.pinchStarted) if (p.source === 'touch' && p.pinchPt.y > h * 0.2 && p.pinchPt.y < h * 0.62) mode === 'play' ? stopAll() : mode === 'idle' && buffer ? play() : null;
      const dur = buffer?.duration ?? 0;
      let reelSpeed = 0;
      if (mode === 'rec') {
        recT += dt;
        reelSpeed = 1;
        if (recT > 120) stopAll();
      } else if (mode === 'play' || mode === 'ff') {
        const r = FX[fx].rate * (mode === 'ff' ? 3 : 1);
        pos = Math.min(dur, pos + dt * r);
        reelSpeed = mode === 'ff' ? 4 : r;
      } else if (mode === 'rew') {
        pos = Math.max(0, pos - dt * 4);
        reelSpeed = -4;
        rewNoise?.set(0.5, 0.9);
        if (pos <= 0) {
          rewNoise?.set(0);
          setMode('idle');
        }
      }
      const prog = dur ? pos / dur : mode === 'rec' ? Math.min(1, recT / 120) : 0;
      // 磁带轮：一边越转越满
      const rA = lerp(1, 0.55, prog), rB = lerp(0.55, 1, prog);
      reelA += (reelSpeed * dt * 4) / rA;
      reelB += (reelSpeed * dt * 4) / rB;
      // VU
      const an = mode === 'rec' ? micAnalyser : outAnalyser && src ? outAnalyser : null;
      let lv = 0;
      if (an) {
        an.getByteTimeDomainData(buf8);
        for (let i = 0; i < an.fftSize && i < buf8.length; i++) lv = Math.max(lv, Math.abs(buf8[i] - 128) / 128);
      }
      vu = lerp(vu, lv, 0.35);

      c.clear();
      const g = c.ctx;
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#1b1612');
      bg.addColorStop(1, '#0b0907');
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      const W = Math.min(w * 0.92, 520), H = W * 0.62;
      const x0 = (w - W) / 2, y0 = Math.max(80, h * 0.4 - H / 2);
      // 机身
      g.fillStyle = '#c8b89a';
      g.beginPath();
      g.roundRect(x0, y0, W, H, 18);
      g.fill();
      g.fillStyle = '#3a332b';
      g.beginPath();
      g.roundRect(x0 + W * 0.04, y0 + H * 0.06, W * 0.92, H * 0.6, 10);
      g.fill();
      // 磁带
      const cx0 = x0 + W * 0.12, cy0 = y0 + H * 0.11, cw = W * 0.76, ch = H * 0.5;
      g.fillStyle = '#e9e1cf';
      g.beginPath();
      g.roundRect(cx0, cy0, cw, ch, 8);
      g.fill();
      g.fillStyle = mode === 'rec' ? '#c23b2e' : '#d8b46a';
      g.fillRect(cx0, cy0 + ch * 0.08, cw, ch * 0.2);
      g.fillStyle = '#1a1208';
      g.font = `700 ${W * 0.035}px ${SERIF}`;
      g.textAlign = 'left';
      g.fillText('灵境 · C-60', cx0 + cw * 0.05, cy0 + ch * 0.22);
      g.textAlign = 'right';
      g.font = `${W * 0.028}px ${FONT}`;
      g.fillText(FX[fx].name, cx0 + cw * 0.95, cy0 + ch * 0.22);
      // 窗口
      const wx = cx0 + cw * 0.18, wy = cy0 + ch * 0.36, ww = cw * 0.64, wh = ch * 0.44;
      g.fillStyle = '#2a2420';
      g.beginPath();
      g.roundRect(wx, wy, ww, wh, wh / 2);
      g.fill();
      const reels = [
        { x: wx + wh / 2 + 4, r: rA, a: reelA },
        { x: wx + ww - wh / 2 - 4, r: rB, a: reelB },
      ];
      for (const rl of reels) {
        const R = (wh / 2) * 0.95;
        g.beginPath();
        g.arc(rl.x, wy + wh / 2, R * rl.r, 0, Math.PI * 2);
        g.fillStyle = '#5a3a26';
        g.fill();
        g.save();
        g.translate(rl.x, wy + wh / 2);
        g.rotate(rl.a);
        g.fillStyle = '#efe6d4';
        g.beginPath();
        g.arc(0, 0, R * 0.38, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#2a2420';
        for (let k = 0; k < 6; k++) {
          g.save();
          g.rotate((k * Math.PI) / 3);
          g.fillRect(-R * 0.05, R * 0.12, R * 0.1, R * 0.2);
          g.restore();
        }
        g.restore();
      }
      // 计数器 & VU
      const vx = x0 + W * 0.06, vy = y0 + H * 0.72, vw = W * 0.4, vh = H * 0.2;
      g.fillStyle = '#f3e9cf';
      g.beginPath();
      g.roundRect(vx, vy, vw, vh, 6);
      g.fill();
      for (let k = 0; k <= 10; k++) {
        const a = Math.PI * (1.15 + k * 0.07);
        g.strokeStyle = k > 7 ? '#c23b2e' : '#3a332b';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(vx + vw / 2 + Math.cos(a) * vh * 0.75, vy + vh * 0.95 + Math.sin(a) * vh * 0.75);
        g.lineTo(vx + vw / 2 + Math.cos(a) * vh * 0.88, vy + vh * 0.95 + Math.sin(a) * vh * 0.88);
        g.stroke();
      }
      const na = Math.PI * (1.15 + clamp(vu * 1.6, 0, 1) * 0.7);
      g.strokeStyle = '#c23b2e';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(vx + vw / 2, vy + vh * 0.95);
      g.lineTo(vx + vw / 2 + Math.cos(na) * vh * 0.9, vy + vh * 0.95 + Math.sin(na) * vh * 0.9);
      g.stroke();
      g.fillStyle = '#3a332b';
      g.font = `600 ${W * 0.025}px ${FONT}`;
      g.textAlign = 'center';
      g.fillText('VU', vx + vw / 2, vy + vh * 0.55);
      // 时间
      const t = mode === 'rec' ? recT : pos;
      const mm = String(Math.floor(t / 60)).padStart(2, '0'), ss = String(Math.floor(t % 60)).padStart(2, '0');
      g.fillStyle = '#1a1208';
      g.beginPath();
      g.roundRect(x0 + W * 0.52, vy, W * 0.42, vh, 6);
      g.fill();
      g.fillStyle = mode === 'rec' ? '#ff6a5a' : '#5fe3b0';
      g.font = `700 ${W * 0.06}px ui-monospace, Menlo, Consolas, monospace`;
      g.fillText(`${mm}:${ss}`, x0 + W * 0.73, vy + vh * 0.68);
      if (mode === 'rec' && Math.floor(recT * 2) % 2 === 0) {
        g.beginPath();
        g.arc(x0 + W * 0.56, vy + vh * 0.3, 5, 0, Math.PI * 2);
        g.fillStyle = '#ff3b30';
        g.fill();
      }
      g.font = `13px ${FONT}`;
      g.fillStyle = 'rgba(236,231,220,0.6)';
      g.fillText(mode === 'rec' ? '正在录音…再点「停止录音」结束（最长 2 分钟）' : buffer ? `录音 ${dur.toFixed(1)} 秒 · 点磁带也能播放` : '点「● 录音」开始，声音只保存在本机', w / 2, y0 + H + 30);
    },
    resize(nw, nh) {
      w = nw;
      h = nh;
      c.resize(w, h);
    },
    dispose() {
      disposed = true;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      stream?.getTracks().forEach((t2) => t2.stop());
      stopSrc();
      rewNoise?.stop();
      outAnalyser?.disconnect();
      c.dispose();
    },
  };
}

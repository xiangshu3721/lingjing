/**
 * WebAudio 合成音效：全部现场合成，没有任何音频文件（无版权问题，不需下载）。
 */
const MUTE_KEY = 'lingjing.muted.v1';

export const PENTA = [0, 2, 4, 7, 9]; // 宫商角徵羽
export function midiToHz(m: number) {
  return 440 * Math.pow(2, (m - 69) / 12);
}
export function pentaHz(i: number, base = 62) {
  const o = Math.floor(i / 5);
  const k = ((i % 5) + 5) % 5;
  return midiToHz(base + o * 12 + PENTA[k]);
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  out: AudioNode | null = null;
  muted = false;
  private noiseBuf: AudioBuffer | null = null;
  private listeners = new Set<(m: boolean) => void>();

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      /* ignore */
    }
  }

  /** 必须在用户手势里调用一次（iOS 要求） */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this.out = this.master;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
    this.listeners.forEach((f) => f(m));
  }
  onMute(f: (m: boolean) => void) {
    this.listeners.add(f);
    return () => this.listeners.delete(f);
  }

  private noise(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (!this.noiseBuf) {
      const n = this.ctx.sampleRate * 2;
      const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = b;
    }
    return this.noiseBuf;
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  tone(freq: number, opts: { type?: OscillatorType; gain?: number; attack?: number; decay?: number; when?: number; detune?: number; dest?: AudioNode } = {}) {
    const c = this.ctx;
    if (!c || !this.out) return;
    const t = c.currentTime + (opts.when ?? 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = opts.type ?? 'sine';
    o.frequency.value = freq;
    if (opts.detune) o.detune.value = opts.detune;
    this.env(g, t, opts.gain ?? 0.2, opts.attack ?? 0.005, opts.decay ?? 0.5);
    o.connect(g).connect(opts.dest ?? this.out);
    o.start(t);
    o.stop(t + (opts.attack ?? 0.005) + (opts.decay ?? 0.5) + 0.05);
  }

  noiseHit(opts: { gain?: number; decay?: number; type?: BiquadFilterType; freq?: number; q?: number; when?: number; attack?: number } = {}) {
    const c = this.ctx;
    const nb = this.noise();
    if (!c || !this.out || !nb) return;
    const t = c.currentTime + (opts.when ?? 0);
    const s = c.createBufferSource();
    s.buffer = nb;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.value = opts.freq ?? 2000;
    f.Q.value = opts.q ?? 1;
    const g = c.createGain();
    this.env(g, t, opts.gain ?? 0.2, opts.attack ?? 0.002, opts.decay ?? 0.2);
    s.connect(f).connect(g).connect(this.out);
    s.start(t, Math.random());
    s.stop(t + (opts.decay ?? 0.2) + 0.1);
  }

  /** 颂钵：非谐泛音 + 成对微失谐产生「嗡嗡」拍频，长衰减 */
  bowl(freq = 196, strength = 1) {
    const ratios = [1, 2.71, 5.15, 8.4, 12.1];
    const amps = [1, 0.55, 0.3, 0.14, 0.06];
    ratios.forEach((r, i) => {
      const dec = 9 / (1 + i * 0.7);
      this.tone(freq * r, { gain: 0.16 * amps[i] * strength, attack: 0.004, decay: dec });
      this.tone(freq * r + 0.8 + i * 0.6, { gain: 0.1 * amps[i] * strength, attack: 0.01, decay: dec * 0.9 });
    });
    this.noiseHit({ gain: 0.05 * strength, decay: 0.05, freq: 3000 });
  }

  /** 连续摩擦钵沿的声音：返回控制器 */
  rubVoice(freq = 196) {
    const c = this.ctx;
    if (!c || !this.out) return null;
    const g = c.createGain();
    g.gain.value = 0;
    g.connect(this.out);
    const oscs = [1, 1.004, 2.71, 2.716].map((r, i) => {
      const o = c.createOscillator();
      o.frequency.value = freq * r;
      const og = c.createGain();
      og.gain.value = i < 2 ? 0.12 : 0.05;
      o.connect(og).connect(g);
      o.start();
      return o;
    });
    return {
      set: (level: number) => g.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.9, c.currentTime, 0.25),
      stop: () => {
        g.gain.setTargetAtTime(0, c.currentTime, 0.4);
        oscs.forEach((o) => o.stop(c.currentTime + 2));
      },
    };
  }

  /** 木鱼「笃」 */
  woodfish(pitch = 1) {
    this.tone(720 * pitch, { gain: 0.5, attack: 0.001, decay: 0.09 });
    this.tone(1440 * pitch * 1.02, { gain: 0.12, attack: 0.001, decay: 0.05 });
    this.tone(380 * pitch, { gain: 0.25, attack: 0.001, decay: 0.14, type: 'triangle' });
    this.noiseHit({ gain: 0.18, decay: 0.03, freq: 2500, q: 2 });
  }

  /** 古筝式拨弦（Karplus-Strong 离线合成） */
  pluck(freq: number, gain = 0.35, when = 0, dur = 2.2) {
    const c = this.ctx;
    if (!c || !this.out) return;
    const sr = c.sampleRate;
    const n = Math.floor(sr * dur);
    const buf = c.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    const p = Math.max(2, Math.round(sr / freq));
    const ring = new Float32Array(p);
    for (let i = 0; i < p; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0;
    for (let i = 0; i < n; i++) {
      const nx = (idx + 1) % p;
      const v = ring[idx];
      ring[idx] = 0.4985 * (v + ring[nx]);
      d[i] = v;
      idx = nx;
    }
    const s = c.createBufferSource();
    s.buffer = buf;
    const g = c.createGain();
    const t = c.currentTime + when;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = Math.min(9000, freq * 8);
    s.connect(f).connect(g).connect(this.out);
    s.start(t);
  }

  chime(freq = 1046, gain = 0.15, when = 0) {
    this.tone(freq, { gain, decay: 1.6, when });
    this.tone(freq * 2.4, { gain: gain * 0.3, decay: 0.8, when });
  }

  sparkle(n = 6) {
    for (let i = 0; i < n; i++) this.chime(pentaHz(10 + Math.floor(Math.random() * 8), 72), 0.06, i * 0.04 + Math.random() * 0.03);
  }

  burst() {
    this.noiseHit({ gain: 0.25, decay: 0.35, type: 'highpass', freq: 1500 });
    this.tone(180, { gain: 0.3, decay: 0.3, type: 'triangle' });
    this.sparkle(8);
  }

  crackTick() {
    this.noiseHit({ gain: 0.05, decay: 0.02, freq: 4000 + Math.random() * 3000, q: 4 });
  }

  shatter() {
    this.noiseHit({ gain: 0.45, decay: 0.6, type: 'highpass', freq: 2500 });
    this.tone(90, { gain: 0.35, decay: 0.4, type: 'triangle' });
    for (let i = 0; i < 18; i++) this.tone(2500 + Math.random() * 4500, { gain: 0.04, decay: 0.15 + Math.random() * 0.3, when: Math.random() * 0.9 });
  }

  whoosh(up = true, gain = 0.15) {
    const c = this.ctx;
    const nb = this.noise();
    if (!c || !this.out || !nb) return;
    const t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = nb;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(up ? 300 : 2500, t);
    f.frequency.exponentialRampToValueAtTime(up ? 2500 : 300, t + 0.4);
    const g = c.createGain();
    this.env(g, t, gain, 0.08, 0.4);
    s.connect(f).connect(g).connect(this.out);
    s.start(t);
    s.stop(t + 0.6);
  }

  pop(freq = 600) {
    const c = this.ctx;
    if (!c || !this.out) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 2.2, t + 0.08);
    this.env(g, t, 0.25, 0.003, 0.12);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.2);
  }

  success() {
    [0, 2, 4, 7].forEach((k, i) => this.pluck(pentaHz(5 + k, 62), 0.25, i * 0.09, 1.6));
  }

  fail() {
    this.tone(140, { gain: 0.3, decay: 0.35, type: 'triangle' });
    this.tone(105, { gain: 0.2, decay: 0.45, type: 'sine', when: 0.08 });
  }

  /** 持续的水流声，返回控制器 */
  waterVoice() {
    const c = this.ctx;
    const nb = this.noise();
    if (!c || !this.out || !nb) return null;
    const s = c.createBufferSource();
    s.buffer = nb;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 0.8;
    const g = c.createGain();
    g.gain.value = 0;
    s.connect(f).connect(g).connect(this.out);
    s.start();
    let alive = true;
    return {
      set: (level: number, bright = 0.5) => {
        if (!alive) return;
        g.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.22, c.currentTime, 0.08);
        f.frequency.setTargetAtTime(500 + bright * 1600 + Math.random() * 200, c.currentTime, 0.05);
      },
      stop: () => {
        alive = false;
        g.gain.setTargetAtTime(0, c.currentTime, 0.1);
        s.stop(c.currentTime + 0.6);
      },
    };
  }

  /** 低沉的催眠嗡鸣 */
  drone(freq = 110) {
    const c = this.ctx;
    if (!c || !this.out) return null;
    const g = c.createGain();
    g.gain.value = 0;
    g.connect(this.out);
    const os = [1, 1.5, 2.003].map((r) => {
      const o = c.createOscillator();
      o.frequency.value = freq * r;
      o.connect(g);
      o.start();
      return o;
    });
    return {
      set: (v: number) => g.gain.setTargetAtTime(v * 0.08, c.currentTime, 0.4),
      stop: () => {
        g.gain.setTargetAtTime(0, c.currentTime, 0.3);
        os.forEach((o) => o.stop(c.currentTime + 1.5));
      },
    };
  }
}

export const audio = new AudioEngine();

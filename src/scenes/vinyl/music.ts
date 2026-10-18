/**
 * 原创生成音乐：用 OfflineAudioContext 在本机实时合成成 AudioBuffer（无任何音频文件、无版权）。
 * 渲染成 buffer 后可以自由变速（搓碟、刹车），本地音乐文件也走同一条路。
 */
const PENTA = [0, 2, 4, 7, 9];
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const penta = (i: number, base: number) => hz(base + Math.floor(i / 5) * 12 + PENTA[((i % 5) + 5) % 5]);

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noiseBuffer(c: BaseAudioContext, sec = 1) {
  const b = c.createBuffer(1, Math.floor(c.sampleRate * sec), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function reverb(c: BaseAudioContext, sec = 2.5, decay = 3) {
  const len = Math.floor(c.sampleRate * sec);
  const b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  const cv = c.createConvolver();
  cv.buffer = b;
  return cv;
}

function env(g: GainNode, t: number, peak: number, a: number, d: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function osc(c: BaseAudioContext, dest: AudioNode, f: number, t: number, peak: number, a: number, d: number, type: OscillatorType = 'sine', detune = 0) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = f;
  o.detune.value = detune;
  env(g, t, peak, a, d);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + a + d + 0.05);
}

function pluck(c: BaseAudioContext, dest: AudioNode, f: number, t: number, gain: number, dur = 2.5) {
  const sr = c.sampleRate;
  const n = Math.floor(sr * dur);
  const buf = c.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  const p = Math.max(2, Math.round(sr / f));
  const ring = new Float32Array(p);
  for (let i = 0; i < p; i++) ring[i] = Math.random() * 2 - 1;
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const nx = (idx + 1) % p;
    const v = ring[idx];
    ring[idx] = 0.4988 * (v + ring[nx]);
    d[i] = v;
    idx = nx;
  }
  const s = c.createBufferSource();
  s.buffer = buf;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(g).connect(dest);
  s.start(t);
}

function crackle(c: BaseAudioContext, dest: AudioNode, dur: number, rnd: () => number) {
  const sr = c.sampleRate;
  const b = c.createBuffer(1, Math.floor(sr * dur), sr);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    d[i] = (Math.random() * 2 - 1) * 0.004;
    if (rnd() < 0.0004) d[i] += (rnd() * 2 - 1) * 0.5;
  }
  const s = c.createBufferSource();
  s.buffer = b;
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 1500;
  s.connect(f).connect(dest);
  s.start(0);
}

export interface Track {
  title: string;
  sub: string;
  color: string;
  render: (sr: number) => Promise<AudioBuffer>;
}

async function make(sec: number, sr: number, build: (c: OfflineAudioContext, out: AudioNode) => void) {
  const c = new OfflineAudioContext(2, Math.floor(sec * sr), sr);
  const master = c.createGain();
  master.gain.value = 0.8;
  const comp = c.createDynamicsCompressor();
  master.connect(comp).connect(c.destination);
  build(c, master);
  return c.startRendering();
}

/** 竹林 lo-fi：80 BPM，鼓 + 电钢琴和弦 + 黑胶噪声 */
function lofi(sr: number) {
  const bpm = 80, beat = 60 / bpm, bars = 8, sec = bars * 4 * beat;
  return make(sec, sr, (c, out) => {
    const rnd = mulberry(7);
    const nb = noiseBuffer(c, 1);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    lp.connect(out);
    const rv = reverb(c, 1.8, 3);
    const rvg = c.createGain();
    rvg.gain.value = 0.25;
    rv.connect(rvg).connect(out);
    const prog = [
      [57, 60, 64, 67],
      [53, 57, 60, 64],
      [55, 59, 62, 65],
      [52, 55, 59, 62],
    ];
    for (let bar = 0; bar < bars; bar++) {
      const t0 = bar * 4 * beat;
      // 和弦（电钢琴感：正弦 + 少量三角，慢起）
      for (const m of prog[bar % 4]) {
        osc(c, lp, hz(m), t0, 0.07, 0.02, 4 * beat, 'sine');
        osc(c, lp, hz(m) * 2, t0, 0.012, 0.01, 2 * beat, 'triangle');
        osc(c, rv, hz(m), t0, 0.03, 0.02, 3 * beat, 'sine');
      }
      // 贝斯
      osc(c, lp, hz(prog[bar % 4][0] - 12), t0, 0.22, 0.01, beat * 1.5, 'triangle');
      osc(c, lp, hz(prog[bar % 4][0] - 12), t0 + beat * 2.5, 0.16, 0.01, beat, 'triangle');
      for (let b = 0; b < 4; b++) {
        const t = t0 + b * beat;
        // 底鼓
        if (b === 0 || b === 2 || (b === 3 && rnd() < 0.3)) {
          const o = c.createOscillator();
          const g = c.createGain();
          o.frequency.setValueAtTime(110, t);
          o.frequency.exponentialRampToValueAtTime(42, t + 0.15);
          env(g, t, 0.6, 0.003, 0.3);
          o.connect(g).connect(out);
          o.start(t);
          o.stop(t + 0.4);
        }
        // 军鼓（2、4 拍）
        if (b === 1 || b === 3) {
          const s = c.createBufferSource();
          s.buffer = nb;
          const f = c.createBiquadFilter();
          f.type = 'bandpass';
          f.frequency.value = 1800;
          const g = c.createGain();
          env(g, t + 0.02, 0.28, 0.002, 0.18);
          s.connect(f).connect(g).connect(out);
          s.connect(f).connect(rv);
          s.start(t + 0.02, rnd());
          s.stop(t + 0.3);
        }
        // 踩镲（八分，摇摆）
        for (const off of [0, 0.58]) {
          const s = c.createBufferSource();
          s.buffer = nb;
          const f = c.createBiquadFilter();
          f.type = 'highpass';
          f.frequency.value = 7000;
          const g = c.createGain();
          env(g, t + off * beat, off ? 0.05 : 0.08, 0.001, 0.05);
          s.connect(f).connect(g).connect(out);
          s.start(t + off * beat, rnd());
          s.stop(t + off * beat + 0.1);
        }
      }
      // 旋律点缀
      if (bar % 2 === 1) for (let k = 0; k < 3; k++) pluck(c, rv, penta(10 + Math.floor(rnd() * 6), 57), t0 + (1 + k * 0.75) * beat, 0.12, 1.5);
    }
    crackle(c, out, sec, rnd);
  });
}

/** 古筝 · 山水：五声音阶拨弦琶音 + 长混响 */
function guzheng(sr: number) {
  const sec = 36;
  return make(sec, sr, (c, out) => {
    const rnd = mulberry(23);
    const rv = reverb(c, 3.5, 2.5);
    const rvg = c.createGain();
    rvg.gain.value = 0.5;
    rv.connect(rvg).connect(out);
    const dry = c.createGain();
    dry.gain.value = 0.8;
    dry.connect(out);
    // 低音持续
    for (let t = 0; t < sec; t += 6) osc(c, rv, hz(38), t, 0.08, 1.5, 5, 'sine');
    let t = 0.2;
    let i = 5;
    while (t < sec - 2) {
      const phrase = 4 + Math.floor(rnd() * 5);
      for (let k = 0; k < phrase && t < sec - 2; k++) {
        i += Math.floor(rnd() * 5) - 2;
        i = Math.max(0, Math.min(14, i));
        const f = penta(i, 50);
        pluck(c, dry, f, t, 0.3, 3);
        pluck(c, rv, f, t, 0.15, 3);
        // 刮奏 / 揉弦（偶尔）
        if (rnd() < 0.12) for (let g = 0; g < 6; g++) pluck(c, rv, penta(i + g, 50), t + 0.04 * g, 0.08, 1.5);
        t += [0.3, 0.45, 0.6, 0.9][Math.floor(rnd() * 4)];
      }
      t += 1 + rnd();
    }
  });
}

/** 云 ambient：慢速和声 pad + 风铃 */
function ambient(sr: number) {
  const sec = 40;
  return make(sec, sr, (c, out) => {
    const rnd = mulberry(91);
    const rv = reverb(c, 4, 2);
    const rvg = c.createGain();
    rvg.gain.value = 0.6;
    rv.connect(rvg).connect(out);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    lp.connect(out);
    lp.connect(rv);
    const chords = [
      [50, 57, 62, 66],
      [48, 55, 60, 64],
      [45, 52, 57, 62],
      [47, 54, 59, 62],
    ];
    for (let k = 0; k < 4; k++) {
      const t = k * 10;
      for (const m of chords[k]) for (const det of [-8, 8]) osc(c, lp, hz(m), t, 0.035, 3, 8.5, 'sawtooth', det);
    }
    for (let t = 1; t < sec - 2; t += 0.6 + rnd() * 1.8) {
      const f = penta(15 + Math.floor(rnd() * 8), 62);
      osc(c, rv, f, t, 0.05, 0.003, 2.5);
      osc(c, rv, f * 2.76, t, 0.012, 0.003, 1.2);
    }
  });
}

export const TRACKS: Track[] = [
  { title: '竹林 Lo-fi', sub: '80 BPM · 雨夜书房', color: '#d8b46a', render: lofi },
  { title: '山水 · 筝', sub: '五声音阶 · 拨弦', color: '#5fe3b0', render: guzheng },
  { title: '云上 Ambient', sub: '和声 · 风铃', color: '#9fc0ff', render: ambient },
];

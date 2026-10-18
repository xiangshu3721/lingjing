/**
 * MediaPipe 识别器池：手 / 脸 / 身体，按场景需要懒加载；GPU 优先（带超时），失败回退 CPU。
 * 识别器在场景之间复用（同一个页面只加载一次）。
 */
import type { FaceLandmarker, FaceLandmarkerResult, HandLandmarker, HandLandmarkerResult, PoseLandmarker, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { expectedSize, fetchAsset } from './assets';
import type { Needs } from './types';

type Delegate = 'GPU' | 'CPU';
const DELEGATE_KEY = 'lingjing.delegate.v1';
const GPU_TIMEOUT = 9000;

export function isIOS() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

function preferCpu() {
  try {
    if (localStorage.getItem(DELEGATE_KEY) === 'CPU') return true;
  } catch {
    /* ignore */
  }
  return isIOS();
}
function rememberCpu() {
  try {
    localStorage.setItem(DELEGATE_KEY, 'CPU');
  } catch {
    /* ignore */
  }
}

function timeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout')), ms);
    p.then(
      (v) => (clearTimeout(t), res(v)),
      (e) => (clearTimeout(t), rej(e)),
    );
  });
}

export const MODEL_FILES = {
  hand: 'models/hand_landmarker.task',
  face: 'models/face_landmarker.task',
  pose: 'models/pose_landmarker_lite.task',
} as const;

type Kind = keyof typeof MODEL_FILES;

interface Fileset {
  wasmLoaderPath: string;
  wasmBinaryPath: string;
}

let filesetP: Promise<Fileset> | null = null;
let simd: boolean | null = null;

async function getFileset(onBytes: (k: string, n: number) => void): Promise<Fileset> {
  if (!filesetP) {
    filesetP = (async () => {
      const vision = await import('@mediapipe/tasks-vision');
      simd = await vision.FilesetResolver.isSimdSupported();
      const base = simd ? 'vision_wasm_internal' : 'vision_wasm_nosimd_internal';
      const [js, wasm] = await Promise.all([
        fetchAsset(`wasm/${base}.js`, (n) => onBytes('js', n)),
        fetchAsset(`wasm/${base}.wasm`, (n) => onBytes('wasm', n)),
      ]);
      return {
        wasmLoaderPath: URL.createObjectURL(new Blob([js as BlobPart], { type: 'text/javascript' })),
        wasmBinaryPath: URL.createObjectURL(new Blob([wasm as BlobPart], { type: 'application/wasm' })),
      };
    })();
    filesetP.catch(() => (filesetP = null));
  }
  return filesetP;
}

export function wasmBytesEstimate() {
  return expectedSize('wasm/vision_wasm_internal.wasm') + expectedSize('wasm/vision_wasm_internal.js');
}

type AnyLandmarker = HandLandmarker | FaceLandmarker | PoseLandmarker;

interface Entry {
  lm: AnyLandmarker | null;
  delegate: Delegate;
  p: Promise<AnyLandmarker>;
  lastTs: number;
  broken?: boolean;
}

const pool: Partial<Record<Kind, Entry>> = {};

async function create(kind: Kind, fileset: Fileset, model: Uint8Array, delegate: Delegate): Promise<AnyLandmarker> {
  const vision = await import('@mediapipe/tasks-vision');
  const baseOptions = { modelAssetBuffer: model.slice(), delegate };
  if (kind === 'hand')
    return vision.HandLandmarker.createFromOptions(fileset, {
      baseOptions,
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.5,
    });
  if (kind === 'face')
    return vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions,
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      minFaceDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  return vision.PoseLandmarker.createFromOptions(fileset, {
    baseOptions,
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

function warm(lm: AnyLandmarker, e: Entry) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 48;
  c.getContext('2d')?.fillRect(0, 0, 64, 48);
  e.lastTs = performance.now();
  lm.detectForVideo(c, e.lastTs);
}

function ensure(kind: Kind, onBytes: (k: string, n: number) => void): Entry {
  const existing = pool[kind];
  if (existing && !existing.broken) return existing;
  const entry: Entry = { lm: null, delegate: 'GPU', lastTs: 0, p: null as unknown as Promise<AnyLandmarker> };
  entry.p = (async () => {
    const [fileset, model] = await Promise.all([getFileset(onBytes), fetchAsset(MODEL_FILES[kind], (n) => onBytes(kind, n))]);
    let lm: AnyLandmarker | null = null;
    if (!preferCpu()) {
      const g = create(kind, fileset, model, 'GPU');
      try {
        lm = await timeout(g, GPU_TIMEOUT);
        warm(lm, entry);
        entry.delegate = 'GPU';
      } catch (e) {
        console.warn('[灵境] GPU 不可用，改用 CPU', e);
        rememberCpu();
        g.then((x) => x.close()).catch(() => {});
        lm = null;
      }
    }
    if (!lm) {
      lm = await create(kind, fileset, model, 'CPU');
      entry.delegate = 'CPU';
      try {
        warm(lm, entry);
      } catch {
        /* ignore */
      }
    }
    entry.lm = lm;
    return lm;
  })();
  entry.p.catch(() => (entry.broken = true));
  pool[kind] = entry;
  return entry;
}

export interface LoadProgress {
  loaded: number;
  total: number;
}

/** 加载场景需要的识别器；返回在全部就绪后 resolve */
export async function loadNeeds(needs: Needs, onProgress: (p: LoadProgress) => void): Promise<void> {
  const kinds = (Object.keys(MODEL_FILES) as Kind[]).filter((k) => needs[k]);
  if (!kinds.length) return;
  const bytes: Record<string, number> = {};
  const total = wasmBytesEstimate() + kinds.reduce((s, k) => s + expectedSize(MODEL_FILES[k]), 0);
  const onBytes = (k: string, n: number) => {
    bytes[k] = n;
    const loaded = Object.values(bytes).reduce((a, b) => a + b, 0);
    onProgress({ loaded: Math.min(loaded, total), total });
  };
  onProgress({ loaded: 0, total });
  await Promise.all(kinds.map((k) => ensure(k, onBytes).p));
  onProgress({ loaded: total, total });
}

export function getDelegate(kind: Kind) {
  return pool[kind]?.delegate;
}

export interface RawResults {
  hand: HandLandmarkerResult | null;
  face: FaceLandmarkerResult | null;
  pose: PoseLandmarkerResult | null;
}

/** 对一帧运行指定识别器；出错时 GPU 自动降级 CPU（下次重建） */
export function detect(kind: Kind, video: HTMLVideoElement, now: number): unknown {
  const e = pool[kind];
  if (!e || !e.lm) return null;
  const ts = Math.max(now, e.lastTs + 1);
  e.lastTs = ts;
  try {
    return (e.lm as HandLandmarker).detectForVideo(video, ts);
  } catch (err) {
    console.warn('[灵境] 识别出错', kind, err);
    if (e.delegate === 'GPU') {
      rememberCpu();
      try {
        e.lm.close();
      } catch {
        /* ignore */
      }
      e.lm = null;
      e.broken = true;
    }
    return null;
  }
}

export function isReady(kind: Kind) {
  return !!pool[kind]?.lm;
}

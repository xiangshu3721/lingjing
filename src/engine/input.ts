/**
 * 把识别结果 + 触屏/鼠标 统一成 InputFrame（舞台像素坐标）。
 * 没有摄像头时，按下的手指/鼠标被当作「捏合的手」，所以所有场景都能用触屏玩。
 */
import type { FaceLandmarkerResult, HandLandmarkerResult, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { classifyHand, handRoll, isPalmFlat, matchIds, palmSize } from './gestures';
import { mapPoint, type CoverMap } from './mapping';
import { OneEuroFilter } from './oneEuro';
import type { Face, Hand, InputFrame, Pose, Pt } from './types';

export type PointerMode = 'single' | 'twoHand';

interface PtrState {
  x: number;
  y: number;
  down: boolean;
  type: string;
  downX: number;
  downY: number;
}

interface Track {
  id: number;
  x: number;
  y: number;
  pinching: boolean;
  filters: OneEuroFilter[];
  palm: Pt;
  t: number;
}

const TOUCH_BASE = 1000;

export class InputBuilder {
  pointers = new Map<number, PtrState>();
  pointerMode: PointerMode = 'single';
  private tracks: Track[] = [];
  private nextId = 1;
  private lastHandRaw: HandLandmarkerResult | null = null;
  private camHands: Hand[] = [];
  private prevPinch = new Map<number, Hand>();
  private touchPrev = new Map<number, { x: number; y: number; t: number }>();

  reset() {
    this.tracks = [];
    this.camHands = [];
    this.lastHandRaw = null;
    this.prevPinch.clear();
    this.pointers.clear();
  }

  pointerDown(id: number, x: number, y: number, type: string) {
    this.pointers.set(id, { x, y, down: true, type, downX: x, downY: y });
  }
  pointerMove(id: number, x: number, y: number, type: string) {
    const p = this.pointers.get(id);
    if (p) {
      p.x = x;
      p.y = y;
    } else if (type === 'mouse') this.pointers.set(id, { x, y, down: false, type, downX: x, downY: y });
  }
  pointerUp(id: number, type: string) {
    const p = this.pointers.get(id);
    if (!p) return;
    if (type === 'mouse') p.down = false;
    else this.pointers.delete(id);
  }
  pointerLeave(id: number) {
    const p = this.pointers.get(id);
    if (p && !p.down) this.pointers.delete(id);
  }

  private buildCamHands(raw: HandLandmarkerResult, m: CoverMap, t: number): Hand[] {
    const aspect = m.vw / m.vh;
    const lmsList = raw.landmarks ?? [];
    const wrists = lmsList.map((l) => mapPoint(l[0].x, l[0].y, m, { x: 0, y: 0 }));
    const maxD = Math.max(m.sw, m.sh) * 0.35;
    const ids = matchIds(this.tracks, wrists, maxD, () => this.nextId++);
    const nextTracks: Track[] = [];
    const hands: Hand[] = [];
    lmsList.forEach((lms, i) => {
      const id = ids[i];
      let tr = this.tracks.find((x) => x.id === id);
      if (!tr) {
        tr = { id, x: 0, y: 0, pinching: false, filters: Array.from({ length: 42 }, () => new OneEuroFilter(1.6, 0.012, 1)), palm: { x: 0, y: 0 }, t };
      }
      const c = classifyHand(lms, aspect, tr.pinching);
      const pts: Pt[] = lms.map((l, k) => {
        const p = mapPoint(l.x, l.y, m, { x: 0, y: 0 });
        return { x: tr!.filters[k * 2].filter(p.x, t), y: tr!.filters[k * 2 + 1].filter(p.y, t), z: l.z };
      });
      const palm = avg([pts[0], pts[5], pts[9], pts[13], pts[17]]);
      const dtS = Math.max((t - tr.t) / 1000, 1 / 120);
      const vel = tr.t && tr.palm.x ? { x: (palm.x - tr.palm.x) / dtS, y: (palm.y - tr.palm.y) / dtS } : { x: 0, y: 0 };
      tr.pinching = c.pinching;
      tr.x = wrists[i].x;
      tr.y = wrists[i].y;
      tr.palm = palm;
      tr.t = t;
      nextTracks.push(tr);
      const ps = palmSize(lms, aspect) * m.vh * m.scale;
      hands.push({
        id,
        source: 'camera',
        lm: pts,
        palm,
        pinchPt: { x: (pts[4].x + pts[8].x) / 2, y: (pts[4].y + pts[8].y) / 2 },
        tip: pts[8],
        pinching: c.pinching,
        pinchRatio: c.pinchRatio,
        gesture: c.gesture,
        palmSize: ps,
        vel,
        roll: m.mirror ? -handRoll(lms, aspect) : handRoll(lms, aspect),
        palmFlat: isPalmFlat(lms),
        handedness: raw.handedness?.[i]?.[0]?.categoryName ?? '',
      });
    });
    this.tracks = nextTracks;
    return hands;
  }

  private touchHands(t: number): Hand[] {
    const out: Hand[] = [];
    const downs = [...this.pointers.entries()].filter(([, p]) => p.down);
    const mk = (id: number, x: number, y: number, pinching: boolean): Hand => {
      const pv = this.touchPrev.get(id);
      const dtS = pv ? Math.max((t - pv.t) / 1000, 1 / 120) : 1;
      const vel = pv ? { x: (x - pv.x) / dtS, y: (y - pv.y) / dtS } : { x: 0, y: 0 };
      this.touchPrev.set(id, { x, y, t });
      const p = { x, y };
      return { id, source: 'touch', lm: null, palm: p, pinchPt: p, tip: p, pinching, pinchRatio: pinching ? 0 : 1, gesture: pinching ? 'pinch' : 'point', palmSize: 80, vel, roll: 0, palmFlat: false, handedness: '' };
    };
    if (this.pointerMode === 'twoHand' && downs.length === 1) {
      const [, p] = downs[0];
      out.push(mk(TOUCH_BASE + 900, p.downX, p.downY, true));
      out.push(mk(TOUCH_BASE + 901, p.x, p.y, true));
      return out;
    }
    for (const [pid, p] of this.pointers) {
      if (!p.down && p.type !== 'mouse') continue;
      out.push(mk(TOUCH_BASE + (pid % 800), p.x, p.y, p.down));
    }
    return out;
  }

  build(raw: { hand: HandLandmarkerResult | null; face: FaceLandmarkerResult | null; pose: PoseLandmarkerResult | null }, m: CoverMap | null, t: number, dt: number, w: number, h: number, tracking: boolean): InputFrame {
    if (raw.hand !== this.lastHandRaw) {
      this.lastHandRaw = raw.hand;
      this.camHands = raw.hand && m ? this.buildCamHands(raw.hand, m, t) : [];
      if (!raw.hand) this.tracks = [];
    }
    const hands = [...this.camHands, ...this.touchHands(t)];
    const face = raw.face && m ? buildFace(raw.face, m) : null;
    const pose = raw.pose && m ? buildPose(raw.pose, m) : null;

    const pinchStarted: Hand[] = [];
    const pinchEnded: Hand[] = [];
    const seen = new Set<number>();
    for (const hd of hands) {
      seen.add(hd.id);
      const was = this.prevPinch.get(hd.id);
      if (hd.pinching && !was) pinchStarted.push(hd);
      if (!hd.pinching && was) pinchEnded.push(hd);
      if (hd.pinching) this.prevPinch.set(hd.id, hd);
      else this.prevPinch.delete(hd.id);
    }
    for (const [id, last] of [...this.prevPinch]) {
      if (!seen.has(id)) {
        pinchEnded.push({ ...last, pinching: false });
        this.prevPinch.delete(id);
      }
    }
    for (const id of [...this.touchPrev.keys()]) if (!seen.has(id)) this.touchPrev.delete(id);
    return { t, dt, width: w, height: h, tracking, hands, face, pose, pinchStarted, pinchEnded };
  }
}

function avg(ps: Pt[]): Pt {
  let x = 0, y = 0;
  for (const p of ps) {
    x += p.x;
    y += p.y;
  }
  return { x: x / ps.length, y: y / ps.length };
}

function buildFace(r: FaceLandmarkerResult, m: CoverMap): Face | null {
  const l = r.faceLandmarks?.[0];
  if (!l || l.length < 468) return null;
  const lm = l.map((p) => ({ ...mapPoint(p.x, p.y, m, { x: 0, y: 0 }), z: p.z }));
  const bs: Record<string, number> = {};
  for (const c of r.faceBlendshapes?.[0]?.categories ?? []) bs[c.categoryName] = c.score;
  const g = (k: string) => bs[k] ?? 0;
  const L = lm[234], R = lm[454], top = lm[10], chin = lm[152];
  const eL = lm[33], eR = lm[263];
  // 让 roll 始终用「屏幕左眼 → 屏幕右眼」，镜像与否都正确
  const [a, b] = eL.x < eR.x ? [eL, eR] : [eR, eL];
  const roll = Math.atan2(b.y - a.y, b.x - a.x);
  const width = Math.hypot(R.x - L.x, R.y - L.y);
  const midX = (L.x + R.x) / 2;
  const nose = lm[1];
  return {
    lm,
    bs,
    blink: (g('eyeBlinkLeft') + g('eyeBlinkRight')) / 2,
    mouthOpen: g('jawOpen'),
    smile: (g('mouthSmileLeft') + g('mouthSmileRight')) / 2,
    browUp: g('browInnerUp'),
    frown: (g('browDownLeft') + g('browDownRight')) / 2,
    roll,
    yaw: Math.max(-1, Math.min(1, (nose.x - midX) / (width / 2 || 1))),
    center: { x: (top.x + chin.x) / 2, y: (top.y + chin.y) / 2 },
    width,
    height: Math.hypot(chin.x - top.x, chin.y - top.y),
    nose,
    mouth: { x: (lm[13].x + lm[14].x) / 2, y: (lm[13].y + lm[14].y) / 2 },
  };
}

function buildPose(r: PoseLandmarkerResult, m: CoverMap): Pose | null {
  const l = r.landmarks?.[0];
  if (!l) return null;
  return { lm: l.map((p) => ({ ...mapPoint(p.x, p.y, m, { x: 0, y: 0 }), z: p.z, v: p.visibility ?? 1 })) };
}

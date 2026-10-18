/**
 * 碎屏（复刻视频 2）：捏着拖拽画出发光的锯齿裂痕；松开 → 整个画面碎成 3D 玻璃碎片，
 * 落入黑暗虚空，下方是发光的绿色线框地面，镜头缓缓环绕。再捏一下（或点「复原」）倒放复原。
 */
import * as THREE from 'three';
import { drawVideoCover } from '../../engine/mapping';
import type { InputFrame } from '../../engine/types';
import { button, canvas2d, dist, FONT, rand } from '../kit';
import { createThreeStage, posterCanvas } from '../threeKit';
import type { SceneContext, SceneInstance } from '../types';
import { centroid, shatter, type Poly } from './geometry';

interface Shard {
  mesh: THREE.Group;
  p0: THREE.Vector3;
  r0: THREE.Euler;
  v: THREE.Vector3;
  av: THREE.Vector3;
  delay: number;
  resting: boolean;
  half: number;
  from?: { p: THREE.Vector3; q: THREE.Quaternion };
}

type Mode = 'live' | 'falling' | 'rewind';

export function create(ctx: SceneContext): SceneInstance {
  let w = ctx.width, h = ctx.height;
  const posterLayer = canvas2d(ctx.root, w, h, 1);
  const st = createThreeStage(ctx.root, w, h, { alpha: false, dprCap: 1.5 });
  const crackLayer = canvas2d(ctx.root, w, h);
  st.renderer.setClearColor(0x030405, 1);
  st.renderer.domElement.style.display = 'none';
  const { scene, camera } = st;
  scene.fog = new THREE.Fog(0x030405, h * 1.5, h * 7);

  const drawPoster = () => {
    posterLayer.resize(w, h);
    posterLayer.ctx.drawImage(posterCanvas(w, h, '碎'), 0, 0, w, h);
    posterLayer.canvas.style.display = ctx.hasVideo() ? 'none' : 'block';
  };
  drawPoster();

  // 绿色发光线框地面
  let floor: THREE.Group | null = null;
  const buildFloor = () => {
    if (floor) {
      scene.remove(floor);
      floor.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material)?.dispose?.();
      });
    }
    floor = new THREE.Group();
    const size = Math.max(w, h) * 6;
    const grid = new THREE.GridHelper(size, 60, 0x7dffb0, 0x39ff7a);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.LineBasicMaterial).opacity = 0.9;
    (grid.material as THREE.LineBasicMaterial).blending = THREE.AdditiveBlending;
    const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color: 0x0b3a1f, transparent: true, opacity: 0.35 }));
    glowPlane.rotation.x = -Math.PI / 2;
    glowPlane.position.y = -1;
    floor.add(glowPlane, grid);
    floor.position.y = -h / 2 - h * 0.45;
    scene.add(floor);
  };
  buildFloor();

  let mode: Mode = 'live';
  let crack: { x: number; y: number }[] = [];
  let branches: { x: number; y: number }[][] = [];
  let drawing = false;
  let drawId = -1;
  let shards: Shard[] = [];
  let tex: THREE.Texture | null = null;
  let fallT = 0;
  let rewindT = 0;
  let time = 0;
  const shardGroup = new THREE.Group();
  scene.add(shardGroup);
  const sideMat = new THREE.MeshBasicMaterial({ color: 0xbfeee0, transparent: true, opacity: 0.55 });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xeafff6, transparent: true, opacity: 0.85 });
  const isMobile = Math.min(w, h) < 600;

  const resetBtn = button(ctx, '复原', () => startRewind(), { title: '把碎片复原' });
  resetBtn.style.display = 'none';

  const jag = (p: { x: number; y: number }, prev: { x: number; y: number }) => {
    const dx = p.x - prev.x, dy = p.y - prev.y;
    const l = Math.hypot(dx, dy) || 1;
    const j = rand(-0.45, 0.45) * Math.min(l, 26);
    return { x: p.x + (-dy / l) * j, y: p.y + (dx / l) * j };
  };

  const snapshot = (): HTMLCanvasElement => {
    const s = Math.min(1, 1024 / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * s);
    c.height = Math.round(h * s);
    const g = c.getContext('2d')!;
    g.scale(s, s);
    if (!(ctx.hasVideo() && drawVideoCover(g, ctx.video, w, h, true))) g.drawImage(posterCanvas(w, h, '碎'), 0, 0, w, h);
    g.drawImage(crackLayer.canvas, 0, 0, w, h);
    return c;
  };

  const clearShards = () => {
    for (const s of shards) {
      shardGroup.remove(s.mesh);
      s.mesh.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    }
    shards = [];
    tex?.dispose();
    tex = null;
  };

  const doShatter = () => {
    clearShards();
    const snap = snapshot();
    tex = new THREE.CanvasTexture(snap);
    tex.colorSpace = THREE.SRGBColorSpace;
    const faceMat = new THREE.MeshBasicMaterial({ map: tex });
    const polys: Poly[] = shatter(w, h, crack, isMobile ? 110 : 170);
    const depth = 7;
    for (const poly of polys) {
      const c = centroid(poly);
      const shape = new THREE.Shape(poly.map((p) => new THREE.Vector2(p.x - c.x, -(p.y - c.y))));
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
      g.translate(0, 0, -depth);
      // uv 用屏幕位置，正面就是原画面
      const pos = g.attributes.position as THREE.BufferAttribute;
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + c.x) / w, 1 - (c.y - pos.getY(i)) / h);
      uv.needsUpdate = true;
      const mesh = new THREE.Mesh(g, [faceMat, sideMat]);
      const eg = new THREE.EdgesGeometry(g, 30);
      const edge = new THREE.LineSegments(eg, edgeMat);
      const grp = new THREE.Group();
      grp.add(mesh, edge);
      const p0 = new THREE.Vector3(c.x - w / 2, h / 2 - c.y, 0);
      grp.position.copy(p0);
      shardGroup.add(grp);
      // 离裂痕最近的点 → 碎片向外飞散的方向和延迟
      let best = crack[0] ?? { x: w / 2, y: h / 2 };
      let bd = Infinity;
      for (let i = 0; i < crack.length; i += 2) {
        const d = dist(crack[i], c);
        if (d < bd) {
          bd = d;
          best = crack[i];
        }
      }
      const dir = new THREE.Vector3(c.x - best.x, -(c.y - best.y), 0).normalize();
      const kick = 120 + 260 * Math.exp(-bd / 200);
      let r = 0;
      for (const q of poly) r = Math.max(r, Math.hypot(q.x - c.x, q.y - c.y));
      shards.push({
        mesh: grp,
        p0,
        r0: new THREE.Euler(),
        v: new THREE.Vector3(dir.x * kick * rand(0.5, 1), dir.y * kick * rand(0.3, 1) + rand(40, 160), rand(80, 420)),
        av: new THREE.Vector3(rand(-3, 3), rand(-3, 3), rand(-2, 2)),
        delay: bd / 1600 + rand(0, 0.12),
        resting: false,
        half: Math.max(4, r * 0.25),
      });
    }
    ctx.audio.shatter();
    mode = 'falling';
    fallT = 0;
    crack = [];
    branches = [];
    crackLayer.clear();
    crackLayer.canvas.style.display = 'none';
    posterLayer.canvas.style.display = 'none';
    st.renderer.domElement.style.display = 'block';
    resetBtn.style.display = '';
    ctx.setHint('碎了！再捏一下（或点「复原」）让碎片倒飞回去');
  };

  const startRewind = () => {
    if (mode !== 'falling') return;
    mode = 'rewind';
    rewindT = 0;
    for (const s of shards) s.from = { p: s.mesh.position.clone(), q: s.mesh.quaternion.clone() };
    ctx.audio.whoosh(true, 0.18);
  };

  const finishRewind = () => {
    clearShards();
    mode = 'live';
    st.renderer.domElement.style.display = 'none';
    crackLayer.canvas.style.display = 'block';
    posterLayer.canvas.style.display = ctx.hasVideo() ? 'none' : 'block';
    resetBtn.style.display = 'none';
    camera.position.set(0, 0, st.dist);
    camera.lookAt(0, 0, 0);
    ctx.setHint('捏着拖拽，松开碎裂');
  };

  const renderCrack = (hand: { x: number; y: number } | null) => {
    crackLayer.clear();
    const g = crackLayer.ctx;
    const stroke = (pts: { x: number; y: number }[], width: number) => {
      if (pts.length < 2) return;
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.lineJoin = 'miter';
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(190,255,235,0.55)';
      g.lineWidth = width * 3.5;
      g.shadowColor = '#bfffe8';
      g.shadowBlur = 22;
      g.stroke();
      g.shadowBlur = 8;
      g.strokeStyle = '#ffffff';
      g.lineWidth = width;
      g.stroke();
      g.shadowBlur = 0;
    };
    stroke(crack, 2.4);
    for (const b of branches) stroke(b, 1.2);
    if (hand && mode === 'live') {
      g.font = `600 15px ${FONT}`;
      g.textAlign = 'center';
      const text = '捏着拖拽，松开碎裂';
      const tw = g.measureText(text).width + 24;
      const tx = Math.min(Math.max(hand.x, tw / 2 + 8), w - tw / 2 - 8);
      const ty = Math.max(hand.y - 46, 70);
      g.fillStyle = 'rgba(8,10,14,0.72)';
      g.beginPath();
      g.roundRect(tx - tw / 2, ty - 20, tw, 30, 15);
      g.fill();
      g.strokeStyle = 'rgba(191,255,232,0.6)';
      g.lineWidth = 1;
      g.stroke();
      g.fillStyle = '#eafff6';
      g.fillText(text, tx, ty);
    }
  };

  const updatePhysics = (dt: number) => {
    fallT += dt;
    const floorY = (floor?.position.y ?? -h) + 2;
    const gravity = -620;
    for (const s of shards) {
      if (fallT < s.delay) {
        // 先微微震一下
        s.mesh.position.z = s.p0.z + Math.sin(fallT * 90 + s.p0.x) * 1.5;
        continue;
      }
      if (s.resting) continue;
      s.v.y += gravity * dt;
      s.v.multiplyScalar(1 - 0.15 * dt);
      s.mesh.position.addScaledVector(s.v, dt);
      s.mesh.rotation.x += s.av.x * dt;
      s.mesh.rotation.y += s.av.y * dt;
      s.mesh.rotation.z += s.av.z * dt;
      if (s.mesh.position.y < floorY + s.half) {
        s.mesh.position.y = floorY + s.half;
        if (Math.abs(s.v.y) < 90) {
          s.resting = true;
          // 平躺在地上
          s.mesh.rotation.x = -Math.PI / 2 + rand(-0.15, 0.15);
          s.mesh.rotation.y = rand(-0.2, 0.2);
        } else {
          s.v.y = -s.v.y * 0.28;
          s.v.x *= 0.6;
          s.v.z *= 0.6;
          s.av.multiplyScalar(0.5);
          if (Math.random() < 0.3) ctx.audio.crackTick();
        }
      }
    }
    // 镜头：从「正对屏幕」慢慢拉远并环绕
    const k = Math.min(1, fallT / 3);
    const e = k * k * (3 - 2 * k);
    const ang = fallT * 0.16;
    const R = st.dist * (1 + 1.1 * e);
    const target = new THREE.Vector3(0, -h * 0.55 * e, 0);
    camera.position.set(Math.sin(ang * e) * R, h * 0.45 * e, Math.cos(ang * e) * R);
    camera.lookAt(target);
  };

  const updateRewind = (dt: number) => {
    rewindT += dt / 1.1;
    const k = Math.min(1, rewindT);
    const e = 1 - Math.pow(1 - k, 3);
    const q0 = new THREE.Quaternion();
    for (const s of shards) {
      if (!s.from) continue;
      s.mesh.position.lerpVectors(s.from.p, s.p0, e);
      s.mesh.quaternion.slerpQuaternions(s.from.q, q0, e);
    }
    camera.position.lerp(new THREE.Vector3(0, 0, st.dist), e * 0.35 + 0.05);
    camera.lookAt(0, 0, 0);
    if (k >= 1) finishRewind();
  };

  let lastTick = 0;
  return {
    update(f: InputFrame) {
      time += f.dt;
      if (posterLayer.canvas.style.display !== 'none' && ctx.hasVideo() && mode === 'live') posterLayer.canvas.style.display = 'none';
      const hand = f.hands[0] ?? null;
      if (mode === 'live') {
        for (const s of f.pinchStarted) {
          if (!drawing) {
            drawing = true;
            drawId = s.id;
            crack = [{ ...s.pinchPt }];
            branches = [];
          }
        }
        const cur = f.hands.find((x) => x.id === drawId && x.pinching);
        if (drawing && cur) {
          const p = cur.pinchPt;
          const lastP = crack[crack.length - 1];
          if (dist(p, lastP) > 14) {
            const jp = jag(p, lastP);
            crack.push(jp);
            if (Math.random() < 0.22) {
              const b = [jp];
              let bx = jp.x, by = jp.y;
              const a = rand(0, Math.PI * 2);
              for (let i = 0; i < 4; i++) {
                bx += Math.cos(a + rand(-0.6, 0.6)) * rand(8, 22);
                by += Math.sin(a + rand(-0.6, 0.6)) * rand(8, 22);
                b.push({ x: bx, y: by });
              }
              branches.push(b);
            }
            if (time - lastTick > 0.04) {
              ctx.audio.crackTick();
              lastTick = time;
            }
          }
        }
        const ended = f.pinchEnded.find((x) => x.id === drawId);
        if (drawing && (ended || !cur)) {
          drawing = false;
          drawId = -1;
          let len = 0;
          for (let i = 1; i < crack.length; i++) len += dist(crack[i], crack[i - 1]);
          if (len > 60) {
            renderCrack(null);
            doShatter();
          } else {
            crack = [];
            branches = [];
          }
        }
        if (mode === 'live') renderCrack(hand ? (cur ? cur.pinchPt : hand.palm) : null);
      } else if (mode === 'falling') {
        updatePhysics(f.dt);
        if (fallT > 1.5 && f.pinchStarted.length) startRewind();
        st.render();
      } else {
        updateRewind(f.dt);
        st.render();
      }
    },
    resize(nw, nh) {
      w = nw;
      h = nh;
      st.resize(w, h);
      crackLayer.resize(w, h);
      drawPoster();
      if (mode !== 'live') finishRewind();
      buildFloor();
    },
    dispose() {
      clearShards();
      sideMat.dispose();
      edgeMat.dispose();
      st.dispose();
      crackLayer.dispose();
      posterLayer.dispose();
    },
  };
}

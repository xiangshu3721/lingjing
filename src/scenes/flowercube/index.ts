/**
 * 花之立方（复刻视频 4）：
 * - 双手捏合 → 两手之间出现半透明玻璃立方体，里面有 3D 粉色花朵，随手缩放/旋转
 * - 松开 → 花与立方体化作旋转的粒子云
 * - 比 L 手势 → 粒子疯狂乱旋
 * - 再捏合 → 粒子重新聚合成花之立方
 */
import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import type { InputFrame } from '../../engine/types';
import { button, canvas2d, clamp, FONT, lerp, rand } from '../kit';
import { createThreeStage, dotTexture, twoPinch } from '../threeKit';
import type { SceneContext, SceneInstance } from '../types';

type Mode = 'empty' | 'held' | 'cloud' | 'assemble';

function petalGeometry() {
  // 一片花瓣：拉长压扁的半球，略微向上卷
  const g = new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(0.55, 0.35, 1);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    p.setY(i, p.getY(i) + z * z * 0.6);
  }
  g.translate(0, 0, 0.5);
  g.computeVertexNormals();
  return g;
}

function buildFlowers(): { group: THREE.Group; meshes: THREE.Mesh[] } {
  const group = new THREE.Group();
  const meshes: THREE.Mesh[] = [];
  const petalG = petalGeometry();
  const colors = [0xff7eb6, 0xff9ccc, 0xff5fa2, 0xffb3d6];
  const flowerAt = (x: number, y: number, z: number, s: number, color: number, tilt: number) => {
    const f = new THREE.Group();
    const pm = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide, emissive: new THREE.Color(color).multiplyScalar(0.25) });
    const layers = [
      { n: 7, r: 0, lift: 0.45, sc: 1 },
      { n: 6, r: 0.4, lift: 0.9, sc: 0.75 },
      { n: 5, r: 0.9, lift: 1.25, sc: 0.5 },
    ];
    for (const L of layers) {
      for (let i = 0; i < L.n; i++) {
        const m = new THREE.Mesh(petalG, pm);
        m.rotation.y = (i / L.n) * Math.PI * 2 + L.r;
        m.rotation.x = -L.lift;
        m.scale.setScalar(L.sc);
        const holder = new THREE.Group();
        holder.add(m);
        f.add(holder);
        meshes.push(m);
      }
    }
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffd36b, emissive: 0x8a5a00, roughness: 0.6 }));
    center.position.y = 0.08;
    f.add(center);
    meshes.push(center);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0x3fae6a, roughness: 0.7 }));
    stem.position.y = -0.7;
    f.add(stem);
    meshes.push(stem);
    const leaf = new THREE.Mesh(petalG, new THREE.MeshStandardMaterial({ color: 0x4fd18a, side: THREE.DoubleSide, roughness: 0.6 }));
    leaf.scale.set(0.5, 0.5, 0.8);
    leaf.position.set(0, -0.8, 0);
    leaf.rotation.set(-0.6, 0.8, 0);
    f.add(leaf);
    meshes.push(leaf);
    f.position.set(x, y, z);
    f.scale.setScalar(s);
    f.rotation.z = tilt;
    group.add(f);
  };
  flowerAt(0, 0.1, 0, 0.38, colors[0], 0);
  flowerAt(-0.22, -0.05, 0.12, 0.26, colors[1], 0.35);
  flowerAt(0.22, -0.02, -0.1, 0.28, colors[2], -0.3);
  flowerAt(0.05, -0.12, 0.24, 0.2, colors[3], -0.1);
  flowerAt(-0.1, 0.0, -0.24, 0.22, colors[1], 0.2);
  return { group, meshes };
}

export function create(ctx: SceneContext): SceneInstance {
  let w = ctx.width, h = ctx.height;
  const st = createThreeStage(ctx.root, w, h, { dprCap: 1.75 });
  const fx = canvas2d(ctx.root, w, h);
  const { scene } = st;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x553355, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(0.5, 1, 1);
  scene.add(key);

  // ---- 花之立方（单位尺寸 1） ----
  const cubeGroup = new THREE.Group();
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshPhysicalMaterial({ color: 0xcfefff, emissive: 0x1a3a4a, transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0, clearcoat: 1, side: THREE.FrontSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  glass.renderOrder = 2;
  const edgeLines = new THREE.LineSegments(new THREE.EdgesGeometry(glass.geometry), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
  const { group: flowers, meshes } = buildFlowers();
  cubeGroup.add(flowers, glass, edgeLines);
  cubeGroup.visible = false;
  scene.add(cubeGroup);

  // ---- 粒子：目标点从花和立方体边上采样 ----
  const N = Math.min(w, h) < 600 ? 2600 : 4200;
  const local = new Float32Array(N * 3);
  const colors = new Float32Array(N * 3);
  cubeGroup.updateMatrixWorld(true);
  const tmp = new THREE.Vector3();
  const col = new THREE.Color();
  const samplers = meshes.map((m) => ({ m, s: new MeshSurfaceSampler(m).build() }));
  const flowerN = Math.floor(N * 0.78);
  for (let i = 0; i < N; i++) {
    if (i < flowerN) {
      const { m, s } = samplers[i % samplers.length];
      s.sample(tmp);
      tmp.applyMatrix4(m.matrixWorld);
      col.copy((m.material as THREE.MeshStandardMaterial).color).offsetHSL(0, 0, rand(0, 0.2));
    } else {
      // 立方体的 12 条棱
      const e = Math.floor(rand(0, 12));
      const axis = e % 3;
      const a = (e >> 2) & 1 ? 0.5 : -0.5;
      const b = e >= 6 ? 0.5 : -0.5;
      const t = rand(-0.5, 0.5);
      const v = [0, 0, 0];
      v[axis] = t;
      v[(axis + 1) % 3] = a;
      v[(axis + 2) % 3] = b;
      tmp.set(v[0], v[1], v[2]);
      col.set(0xeaf6ff);
    }
    local[i * 3] = tmp.x;
    local[i * 3 + 1] = tmp.y;
    local[i * 3 + 2] = tmp.z;
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const sprite = dotTexture();
  const pMat = new THREE.PointsMaterial({ size: 9, map: sprite, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const points = new THREE.Points(pGeo, pMat);
  points.visible = false;
  points.frustumCulled = false;
  scene.add(points);

  let mode: Mode = 'empty';
  const cur = { x: 0, y: 0, size: 200, rz: 0, spin: 0, ry: 0 };
  const cloudCenter = new THREE.Vector3();
  let cloudSize = 200;
  let chaos = 0;
  let chaosForced = false;
  let assembleT = 0;
  let meshFade = 0;
  let lostSince = 0;
  let time = 0;
  const startPos = new Float32Array(N * 3);
  const A = new THREE.Vector3(), B = new THREE.Vector3();

  const chaosBtn = button(ctx, 'L 乱旋', () => {
    chaosForced = !chaosForced;
    chaosBtn.classList.toggle('on', chaosForced);
    if (chaosForced) ctx.audio.whoosh(true, 0.2);
  });

  const setMeshOpacity = (o: number) => {
    cubeGroup.visible = o > 0.01;
    flowers.traverse((x) => {
      const m = (x as THREE.Mesh).material as THREE.Material | undefined;
      if (m) {
        m.transparent = o < 0.999;
        m.opacity = o;
      }
    });
    (glass.material as THREE.Material).opacity = 0.1 * o;
    (edgeLines.material as THREE.Material).opacity = 0.9 * o;
  };

  const worldTargets = (out: Float32Array) => {
    cubeGroup.updateMatrixWorld(true);
    const m = cubeGroup.matrixWorld;
    for (let i = 0; i < N; i++) {
      tmp.set(local[i * 3], local[i * 3 + 1], local[i * 3 + 2]).applyMatrix4(m);
      out[i * 3] = tmp.x;
      out[i * 3 + 1] = tmp.y;
      out[i * 3 + 2] = tmp.z;
    }
  };
  const targets = new Float32Array(N * 3);

  const applyTransform = () => {
    cubeGroup.position.set(cur.x, cur.y, 0);
    cubeGroup.rotation.set(0.35, cur.spin + cur.ry, cur.rz, 'ZYX');
    cubeGroup.scale.setScalar(cur.size);
  };

  const dissolve = () => {
    mode = 'cloud';
    worldTargets(pos);
    for (let i = 0; i < N * 3; i++) vel[i] = rand(-30, 30);
    cloudCenter.set(cur.x, cur.y, 0);
    cloudSize = cur.size;
    points.visible = true;
    meshFade = 1;
    ctx.audio.whoosh(false, 0.16);
    ctx.audio.sparkle(5);
  };

  return {
    update(f: InputFrame) {
      const dt = f.dt;
      time += dt;
      const pair = twoPinch(f);
      const anyL = f.hands.some((x) => x.gesture === 'L');
      fx.clear();

      if (pair) {
        lostSince = 0;
        const [a, b] = pair;
        st.toWorld(a.pinchPt.x, a.pinchPt.y, A);
        st.toWorld(b.pinchPt.x, b.pinchPt.y, B);
        const size = clamp(A.distanceTo(B) * 0.72, 60, Math.min(w, h) * 0.9);
        const ang = Math.atan2(B.y - A.y, B.x - A.x);
        const depth = a.source === 'camera' && b.source === 'camera' ? clamp(((b.palmSize - a.palmSize) / ((a.palmSize + b.palmSize) / 2)) * 1.5, -0.8, 0.8) : 0;
        if (mode === 'empty') {
          mode = 'held';
          cur.x = (A.x + B.x) / 2;
          cur.y = (A.y + B.y) / 2;
          cur.size = size * 0.2;
          cur.rz = ang;
          setMeshOpacity(1);
          ctx.audio.pop(520);
          ctx.audio.sparkle(4);
        } else if (mode === 'cloud') {
          mode = 'assemble';
          assembleT = 0;
          startPos.set(pos);
          ctx.audio.whoosh(true, 0.16);
        }
        cur.x = lerp(cur.x, (A.x + B.x) / 2, 0.4);
        cur.y = lerp(cur.y, (A.y + B.y) / 2, 0.4);
        cur.size = lerp(cur.size, size, 0.3);
        let da = ang - cur.rz;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        cur.rz += da * 0.4;
        cur.ry = lerp(cur.ry, depth, 0.2);
      } else if (mode === 'held' || mode === 'assemble') {
        if (!lostSince) lostSince = f.t;
        if (f.t - lostSince > 250) {
          applyTransform();
          dissolve();
        }
      }
      cur.spin += dt * 0.5;
      applyTransform();

      if (mode === 'held') {
        meshFade = Math.min(1, meshFade + dt * 3);
        setMeshOpacity(meshFade);
        points.visible = false;
      } else if (mode === 'assemble') {
        assembleT += dt / 1.2;
        const k = Math.min(1, assembleT);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        worldTargets(targets);
        for (let i = 0; i < N * 3; i++) pos[i] = startPos[i] + (targets[i] - startPos[i]) * e;
        (pGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        setMeshOpacity(Math.max(0, (k - 0.75) * 4));
        if (k >= 1) {
          mode = 'held';
          meshFade = 1;
          points.visible = false;
          ctx.audio.sparkle(6);
        }
      } else if (mode === 'cloud') {
        meshFade = Math.max(0, meshFade - dt * 4);
        setMeshOpacity(meshFade);
        chaos = lerp(chaos, anyL || chaosForced ? 1 : 0, dt * 3);
        const cx = cloudCenter.x, cy = cloudCenter.y, cz = cloudCenter.z;
        const R = cloudSize * (0.75 + chaos * 0.9);
        const swirl = 1.1 + chaos * 5;
        for (let i = 0; i < N; i++) {
          const j = i * 3;
          const dx = pos[j] - cx, dy = pos[j + 1] - cy, dz = pos[j + 2] - cz;
          const r = Math.hypot(dx, dz) + 1e-3;
          // 绕竖直轴旋转 + 向目标半径收拢 + 上下呼吸 + 噪声
          let ax = (-dz / r) * swirl * R * 0.9 - (dx / r) * (r - R * (0.5 + 0.5 * Math.sin(i))) * 1.2;
          let az = (dx / r) * swirl * R * 0.9 - (dz / r) * (r - R * (0.5 + 0.5 * Math.sin(i))) * 1.2;
          let ay = -dy * 0.9 + Math.sin(time * 1.3 + i * 0.37) * R * 0.25;
          if (chaos > 0.05) {
            ax += Math.sin(time * 3 + i * 1.7) * R * 1.8 * chaos;
            ay += Math.cos(time * 2.6 + i * 2.3) * R * 1.8 * chaos;
            az += Math.sin(time * 2.2 + i * 0.9) * R * 1.8 * chaos;
          }
          vel[j] = lerp(vel[j], ax, dt * 2.2);
          vel[j + 1] = lerp(vel[j + 1], ay, dt * 2.2);
          vel[j + 2] = lerp(vel[j + 2], az, dt * 2.2);
          pos[j] += vel[j] * dt;
          pos[j + 1] += vel[j + 1] * dt;
          pos[j + 2] += vel[j + 2] * dt;
        }
        (pGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        pMat.size = 9 + chaos * 3;
        // 粒子云跟随单手（不捏合时也能拖着走）
        const one = f.hands.find((x) => x.source === 'camera' && x.gesture === 'open');
        if (one) {
          st.toWorld(one.palm.x, one.palm.y, A);
          cloudCenter.lerp(A, dt * 1.5);
        }
      }

      if (mode === 'empty' || (mode === 'cloud' && !pair)) {
        const g = fx.ctx;
        const pinching = f.hands.filter((x) => x.pinching);
        g.font = `500 14px ${FONT}`;
        g.textAlign = 'center';
        g.fillStyle = 'rgba(255,255,255,0.85)';
        for (const p of pinching) {
          g.beginPath();
          g.arc(p.pinchPt.x, p.pinchPt.y, 16, 0, Math.PI * 2);
          g.strokeStyle = '#ff9ccc';
          g.lineWidth = 2;
          g.stroke();
          if (pinching.length === 1) g.fillText('另一只手也捏住', p.pinchPt.x, p.pinchPt.y - 26);
        }
      }
      st.render();
    },
    resize(nw, nh) {
      w = nw;
      h = nh;
      st.resize(w, h);
      fx.resize(w, h);
    },
    dispose() {
      sprite.dispose();
      st.dispose();
      fx.dispose();
    },
  };
}

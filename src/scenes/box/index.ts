/**
 * 指间方盒（复刻视频 1）：双手捏合 → 两个捏合点之间出现 3D 方盒，随手实时拉伸/缩放/旋转。
 * 正面霓虹绿，侧面粉/紫，白色线框边。
 */
import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { InputFrame } from '../../engine/types';
import { canvas2d, clamp, FONT, lerp } from '../kit';
import { createThreeStage, twoPinch } from '../threeKit';
import type { SceneContext, SceneInstance } from '../types';

export function create(ctx: SceneContext): SceneInstance {
  const st = createThreeStage(ctx.root, ctx.width, ctx.height);
  const fx = canvas2d(ctx.root, ctx.width, ctx.height);
  const { scene } = st;

  const faceMat = (color: number, opacity: number) =>
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, blending: THREE.NormalBlending });
  // 顺序：+x, -x, +y, -y, +z(正面), -z
  const mats = [faceMat(0xff3fa4, 0.62), faceMat(0xff3fa4, 0.62), faceMat(0xa15cff, 0.62), faceMat(0xa15cff, 0.62), faceMat(0x39ff7a, 0.72), faceMat(0x7a3cff, 0.5)];
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const box = new THREE.Mesh(geo, mats);
  box.renderOrder = 1;

  const edges = new THREE.EdgesGeometry(geo);
  const lg = new LineSegmentsGeometry().fromEdgesGeometry(edges);
  const lineMat = new LineMaterial({ color: 0xffffff, linewidth: 3, transparent: true, opacity: 1, depthTest: false });
  const glowMat = new LineMaterial({ color: 0xbfffe0, linewidth: 12, transparent: true, opacity: 0.22, depthTest: false, blending: THREE.AdditiveBlending });
  const line = new LineSegments2(lg, lineMat);
  const glow = new LineSegments2(lg, glowMat);
  line.renderOrder = 3;
  glow.renderOrder = 2;
  const group = new THREE.Group();
  group.add(box, glow, line);
  group.visible = false;
  scene.add(group);

  // 内部漂浮的光点，增加体积感
  const dustGeo = new THREE.BufferGeometry();
  const dustN = 60;
  const dp = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN * 3; i++) dp[i] = Math.random() - 0.5;
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xeafff2, size: 3, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  group.add(dust);

  const setRes = () => {
    lineMat.resolution.set(st.w, st.h);
    glowMat.resolution.set(st.w, st.h);
  };
  setRes();

  const cur = { x: 0, y: 0, len: 0, rz: 0, ry: 0.5, rx: 0.3, s: 0 };
  let holding = false;
  let releaseT = 0;
  let lostSince = 0;
  let spin = 0;
  let pulse = 0;
  const A = new THREE.Vector3(), B = new THREE.Vector3();
  let time = 0;

  return {
    update(f: InputFrame) {
      time += f.dt;
      const pair = twoPinch(f);
      fx.clear();
      const g = fx.ctx;
      if (pair) {
        lostSince = 0;
        const [a, b] = pair;
        st.toWorld(a.pinchPt.x, a.pinchPt.y, A);
        st.toWorld(b.pinchPt.x, b.pinchPt.y, B);
        const len = Math.max(30, A.distanceTo(B));
        const angle = Math.atan2(B.y - A.y, B.x - A.x);
        // 远近差 → 绕 y 轴转；手的倾斜 → 绕长轴翻转
        const depth = a.source === 'camera' && b.source === 'camera' ? clamp(((b.palmSize - a.palmSize) / ((a.palmSize + b.palmSize) / 2)) * 1.6, -0.9, 0.9) : 0;
        const roll = a.source === 'camera' && b.source === 'camera' ? clamp((a.roll + b.roll) / 2, -1.2, 1.2) : 0;
        if (!holding) {
          holding = true;
          cur.x = (A.x + B.x) / 2;
          cur.y = (A.y + B.y) / 2;
          cur.len = len;
          cur.rz = angle;
          cur.s = 0;
          pulse = 1;
          ctx.audio.pop(420);
          ctx.audio.whoosh(true, 0.08);
        }
        const k = 0.45;
        cur.x = lerp(cur.x, (A.x + B.x) / 2, k);
        cur.y = lerp(cur.y, (A.y + B.y) / 2, k);
        cur.len = lerp(cur.len, len, k);
        let da = angle - cur.rz;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        cur.rz += da * k;
        cur.ry = lerp(cur.ry, 0.55 + depth, 0.2);
        cur.rx = lerp(cur.rx, 0.35 + roll * 0.8, 0.2);
        cur.s = lerp(cur.s, 1, 0.25);
        // 捏合点上的小光环
        for (const hnd of pair) {
          g.beginPath();
          g.arc(hnd.pinchPt.x, hnd.pinchPt.y, 14 + Math.sin(time * 8) * 2, 0, Math.PI * 2);
          g.strokeStyle = 'rgba(57,255,122,0.9)';
          g.lineWidth = 2;
          g.shadowColor = '#39ff7a';
          g.shadowBlur = 14;
          g.stroke();
          g.shadowBlur = 0;
        }
      } else if (holding) {
        if (!lostSince) lostSince = f.t;
        // 稍等一下再松手，避免单帧丢失导致闪烁
        if (f.t - lostSince > 220) {
          holding = false;
          releaseT = 1;
          ctx.audio.whoosh(false, 0.06);
        }
      }
      if (!holding && releaseT > 0) {
        releaseT = Math.max(0, releaseT - f.dt * 1.4);
        cur.s = releaseT;
        spin += f.dt * 4;
        cur.y += f.dt * 60;
      }
      if (!holding && releaseT <= 0) {
        cur.s = 0;
        spin = 0;
      }
      // 单手捏合时提示另一只
      const pinching = f.hands.filter((h) => h.pinching);
      if (!pair && pinching.length === 1) {
        const p = pinching[0].pinchPt;
        g.beginPath();
        g.arc(p.x, p.y, 16, 0, Math.PI * 2);
        g.strokeStyle = 'rgba(255,63,164,0.9)';
        g.lineWidth = 2;
        g.stroke();
        g.font = `500 14px ${FONT}`;
        g.fillStyle = 'rgba(255,255,255,0.9)';
        g.textAlign = 'center';
        g.fillText('另一只手也捏住', p.x, p.y - 26);
      }

      group.visible = cur.s > 0.01;
      if (group.visible) {
        pulse = Math.max(0, pulse - f.dt * 2);
        const s = cur.s * (1 + pulse * 0.15);
        const hgt = clamp(cur.len * 0.55, 40, 420);
        group.position.set(cur.x, cur.y, 0);
        group.rotation.set(0, 0, 0);
        group.rotateZ(cur.rz);
        group.rotateY(cur.ry + spin);
        group.rotateX(cur.rx + spin * 0.5);
        group.scale.set(cur.len * s, hgt * s, hgt * s);
        const pos = dustGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < dustN; i++) {
          let y = pos.getY(i) + f.dt * 0.08;
          if (y > 0.5) y = -0.5;
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
        lineMat.opacity = Math.min(1, cur.s * 1.2);
        glowMat.opacity = 0.22 * cur.s + pulse * 0.3;
      }
      st.render();
    },
    resize(w, h) {
      st.resize(w, h);
      fx.resize(w, h);
      setRes();
    },
    dispose() {
      lg.dispose();
      edges.dispose();
      st.dispose();
      fx.dispose();
    },
  };
}

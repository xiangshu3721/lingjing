/** Three.js 公共封装：透明渲染器 + 「屏幕平面」相机（z=0 平面上 1 单位 = 1 个 CSS 像素） */
import * as THREE from 'three';
import type { Hand, InputFrame } from '../engine/types';
import { maxDpr } from './kit';

export interface ThreeStage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  w: number;
  h: number;
  /** 相机到 z=0 平面的距离 */
  dist: number;
  resize(w: number, h: number): void;
  /** 舞台像素 → 世界坐标（z=0 平面） */
  toWorld(x: number, y: number, out?: THREE.Vector3): THREE.Vector3;
  render(): void;
  dispose(): void;
}

export const FOV = 45;

export function createThreeStage(parent: HTMLElement, w: number, h: number, opts: { alpha?: boolean; dprCap?: number } = {}): ThreeStage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: opts.alpha ?? true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(maxDpr(), opts.dprCap ?? 2));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'layer';
  parent.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, w / h, 1, 20000);
  const st: ThreeStage = {
    renderer,
    scene,
    camera,
    w,
    h,
    dist: 1,
    resize(nw, nh) {
      st.w = nw;
      st.h = nh;
      renderer.setSize(nw, nh, true);
      camera.aspect = nw / nh;
      st.dist = nh / 2 / Math.tan((FOV * Math.PI) / 360);
      camera.position.set(0, 0, st.dist);
      camera.lookAt(0, 0, 0);
      camera.near = 1;
      camera.far = st.dist * 20;
      camera.updateProjectionMatrix();
    },
    toWorld(x, y, out = new THREE.Vector3()) {
      return out.set(x - st.w / 2, st.h / 2 - y, 0);
    },
    render() {
      renderer.render(scene, camera);
    },
    dispose() {
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose?.();
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
  st.resize(w, h);
  return st;
}

/** 选出两只正在捏合的手（优先摄像头的手），按屏幕 x 从左到右 */
export function twoPinch(f: InputFrame): [Hand, Hand] | null {
  const cam = f.hands.filter((h) => h.pinching && h.source === 'camera');
  const list = cam.length >= 2 ? cam : f.hands.filter((h) => h.pinching);
  if (list.length < 2) return null;
  const [a, b] = list.slice(0, 2).sort((p, q) => p.pinchPt.x - q.pinchPt.x);
  return [a, b];
}

/** 圆形柔光粒子贴图 */
export function dotTexture(size = 64): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 没有摄像头时用来代替画面的「海报」 */
export function posterCanvas(w: number, h: number, title = '灵境'): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const s = Math.min(1, 1280 / Math.max(w, h));
  c.width = Math.max(2, Math.round(w * s));
  c.height = Math.max(2, Math.round(h * s));
  const g = c.getContext('2d')!;
  g.scale(s, s);
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#10141c');
  bg.addColorStop(0.5, '#1b1626');
  bg.addColorStop(1, '#0b1a17');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  // 远山
  for (let k = 0; k < 3; k++) {
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) {
      const y = h * (0.62 + k * 0.1) + Math.sin(x * (0.006 + k * 0.003) + k * 2) * h * 0.05 + Math.sin(x * 0.021 + k) * h * 0.015;
      g.lineTo(x, y);
    }
    g.lineTo(w, h);
    g.closePath();
    g.fillStyle = `rgba(${40 + k * 20},${70 + k * 25},${70 + k * 15},${0.35 + k * 0.2})`;
    g.fill();
  }
  // 月
  g.beginPath();
  g.arc(w * 0.72, h * 0.26, Math.min(w, h) * 0.09, 0, Math.PI * 2);
  g.fillStyle = 'rgba(232,210,160,0.9)';
  g.shadowColor = '#e8d2a0';
  g.shadowBlur = 40;
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(255,255,255,0.88)';
  g.font = `600 ${Math.min(w, h) * 0.16}px "Songti SC", "STSong", serif`;
  g.textAlign = 'center';
  g.fillText(title, w / 2, h * 0.47);
  g.font = `${Math.min(w, h) * 0.035}px system-ui, sans-serif`;
  g.fillStyle = 'rgba(216,180,106,0.85)';
  g.fillText('没有摄像头时，用这幅画代替画面', w / 2, h * 0.47 + Math.min(w, h) * 0.08);
  return c;
}

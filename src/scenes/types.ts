import type { AudioEngine } from '../engine/audio';
import type { PointerMode } from '../engine/input';
import type { CoverMap } from '../engine/mapping';
import type { InputFrame, Needs } from '../engine/types';

export type InputKind = 'hand' | 'face' | 'pose' | 'touch' | 'mic';

export type SceneGroup = 'replica' | 'zen' | 'play' | 'create' | 'style' | 'music';

export const GROUPS: { id: SceneGroup; title: string; desc: string }[] = [
  { id: 'replica', title: '指间幻术', desc: '视频同款 · 捏合、张手、比 L，空气里出现奇迹' },
  { id: 'zen', title: '东方疗愈', desc: '颂钵、木鱼、茶与花 · 慢下来' },
  { id: 'music', title: '声音小馆', desc: '黑胶与磁带 · 声音都在本机合成与保存' },
  { id: 'create', title: '以身作画', desc: '捏合写字，挥掌泼墨' },
  { id: 'play', title: '体感游戏', desc: '动动手、张张嘴' },
  { id: 'style', title: 'AR 换装', desc: '发髻、面具、汉服领 · 一键拍照' },
];

export interface SceneMeta {
  id: string;
  title: string;
  tagline: string;
  group: SceneGroup;
  inputs: InputKind[];
  needs: Needs;
  /** 摄像头操作提示（简短中文） */
  hint: string;
  /** 没有摄像头时的触屏提示 */
  touchHint: string;
  /** 摄像头画面不透明度 0~1 */
  video: number;
  photo?: boolean;
  pointerMode?: PointerMode;
  /** 封面：渐变两色 + 主字 + 点缀色 */
  cover: { from: string; to: string; glyph: string; accent: string; art?: string };
  /** 不需要摄像头（例如录音机） */
  noCamera?: boolean;
}

export interface SceneContext {
  /** 场景画布的容器（在摄像头画面之上） */
  root: HTMLElement;
  /** 场景自己的按钮区域（屏幕下方） */
  ui: HTMLElement;
  video: HTMLVideoElement;
  audio: AudioEngine;
  readonly width: number;
  readonly height: number;
  hasVideo(): boolean;
  cover(): CoverMap | null;
  toast(msg: string): void;
  setHint(msg: string): void;
  setPointerMode(m: PointerMode): void;
  setVideoOpacity(v: number): void;
}

export interface SceneInstance {
  update(f: InputFrame): void;
  resize?(w: number, h: number): void;
  dispose(): void;
}

export interface SceneModule {
  create(ctx: SceneContext): SceneInstance;
}

export interface SceneDef {
  meta: SceneMeta;
  load: () => Promise<SceneModule>;
}

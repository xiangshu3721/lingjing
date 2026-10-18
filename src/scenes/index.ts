import type { SceneDef } from './types';

/** 场景注册表：每个场景按需懒加载（进入时才下载代码和模型） */
export const SCENES: SceneDef[] = [
  {
    meta: {
      id: 'box',
      title: '指间方盒',
      tagline: '双手一捏，空气里拉出一只霓虹方盒',
      group: 'replica',
      inputs: ['hand', 'touch'],
      needs: { hand: true },
      hint: '双手都捏合（拇指碰食指），拉开、靠近、转动——方盒跟着变',
      touchHint: '两指按住拉开，或用鼠标拖一下',
      video: 1,
      photo: true,
      pointerMode: 'twoHand',
      cover: { from: '#0b2a1a', to: '#2a0b2a', glyph: '盒', accent: '#39ff7a', art: 'box' },
    },
    load: () => import('./box'),
  },
  {
    meta: {
      id: 'shatter',
      title: '碎屏',
      tagline: '在空气里划一道裂痕，整个世界碎成玻璃',
      group: 'replica',
      inputs: ['hand', 'touch'],
      needs: { hand: true },
      hint: '捏着拖拽，松开碎裂；碎了以后再捏一下就复原',
      touchHint: '按住拖一条线，松手就碎',
      video: 1,
      photo: true,
      cover: { from: '#06120c', to: '#0f1720', glyph: '碎', accent: '#bfffe8', art: 'shatter' },
    },
    load: () => import('./shatter'),
  },
  {
    meta: {
      id: 'heart',
      title: '心动星河',
      tagline: '画一颗心，张手星爆，挥手起涟漪',
      group: 'replica',
      inputs: ['hand', 'touch'],
      needs: { hand: true },
      hint: '捏合画心 · 张开手星爆 · 张手挥动起水波 · 掌心对镜头别动就会被「催眠」',
      touchHint: '拖动画心；下方按钮切换星爆 / 水波 / 催眠',
      video: 0,
      photo: true,
      cover: { from: '#2a0b1e', to: '#120a24', glyph: '心', accent: '#ff4fa8', art: 'heart' },
    },
    load: () => import('./heart'),
  },
  {
    meta: {
      id: 'flowercube',
      title: '花之立方',
      tagline: '捏出一方玻璃花，松手化作星尘',
      group: 'replica',
      inputs: ['hand', 'touch'],
      needs: { hand: true },
      hint: '双手捏合托出花之立方 · 松手化作粒子 · 比「L」手势粒子乱旋 · 再捏合重新聚拢',
      touchHint: '两指按住拉开；松手散开；再按住聚拢',
      video: 1,
      photo: true,
      pointerMode: 'twoHand',
      cover: { from: '#1d1024', to: '#0c1b24', glyph: '花', accent: '#ff9ccc', art: 'flower' },
    },
    load: () => import('./flowercube'),
  },
];

export function findScene(id: string) {
  return SCENES.find((s) => s.meta.id === id);
}

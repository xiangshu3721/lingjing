/** 二十四节气签：原创短句（非塔罗，无版权图案） */
export interface Card {
  name: string;
  season: '春' | '夏' | '秋' | '冬';
  line: string;
  tip: string;
}

export const DECK: Card[] = [
  { name: '立春', season: '春', line: '冰下有水声，你比自己以为的更早醒来。', tip: '宜：开始一件小事' },
  { name: '雨水', season: '春', line: '慢慢下的雨，最能渗进土里。', tip: '宜：耐心' },
  { name: '惊蛰', season: '春', line: '一声雷，叫醒的是早就准备好的心。', tip: '宜：说出口' },
  { name: '春分', season: '春', line: '昼夜一样长，忙与闲也该各占一半。', tip: '宜：平衡' },
  { name: '清明', season: '春', line: '风很轻，适合想念，也适合放下。', tip: '宜：整理' },
  { name: '谷雨', season: '春', line: '种子不说话，只在雨里长。', tip: '宜：埋头做' },
  { name: '立夏', season: '夏', line: '日子开始变长，给热爱多留一点时间。', tip: '宜：投入' },
  { name: '小满', season: '夏', line: '小满即是好，不必十分。', tip: '宜：知足' },
  { name: '芒种', season: '夏', line: '该忙的时候就忙，汗水会记得你。', tip: '宜：行动' },
  { name: '夏至', season: '夏', line: '光最盛的一天，影子也最短。', tip: '宜：坦荡' },
  { name: '小暑', season: '夏', line: '蝉声渐起，心静自然凉。', tip: '宜：静心' },
  { name: '大暑', season: '夏', line: '最难熬的热，也是果子最甜的前夜。', tip: '宜：坚持' },
  { name: '立秋', season: '秋', line: '一叶知秋，变化总是先从细处来。', tip: '宜：留意' },
  { name: '处暑', season: '秋', line: '暑气退了，执念也可以退一点。', tip: '宜：松手' },
  { name: '白露', season: '秋', line: '夜里凝的露，是白天没说完的温柔。', tip: '宜：关心人' },
  { name: '秋分', season: '秋', line: '收获与告别，常常是同一天。', tip: '宜：感恩' },
  { name: '寒露', season: '秋', line: '天凉了，记得给自己添一件衣。', tip: '宜：照顾自己' },
  { name: '霜降', season: '秋', line: '霜打过的柿子，才最甜。', tip: '宜：熬一熬' },
  { name: '立冬', season: '冬', line: '万物收藏，你也可以慢下来。', tip: '宜：休息' },
  { name: '小雪', season: '冬', line: '雪落无声，好事也常悄悄发生。', tip: '宜：期待' },
  { name: '大雪', season: '冬', line: '覆盖一切的白，是重新开始的纸。', tip: '宜：重来' },
  { name: '冬至', season: '冬', line: '最长的夜过去，白天就一天天长回来。', tip: '宜：相信' },
  { name: '小寒', season: '冬', line: '冷到深处，梅就要开了。', tip: '宜：守候' },
  { name: '大寒', season: '冬', line: '一年最冷时，离春天最近。', tip: '宜：盼春' },
];

export const SEASON_COLOR: Record<Card['season'], { bg: string; ink: string; accent: string }> = {
  春: { bg: '#e7efe0', ink: '#2f4a32', accent: '#7fb07a' },
  夏: { bg: '#f3e6dc', ink: '#5a2a1c', accent: '#e0674e' },
  秋: { bg: '#f0e4c8', ink: '#4a3412', accent: '#d39b3a' },
  冬: { bg: '#e2e8ee', ink: '#22324a', accent: '#6f8fb8' },
};

/** Fisher–Yates 洗牌 */
export function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

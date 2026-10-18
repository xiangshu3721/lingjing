/** 场景卡片封面：纯 SVG 手绘意象，不依赖图片 */
import type { SceneMeta } from '../scenes/types';

export function Cover({ meta }: { meta: SceneMeta }) {
  const { from, to, glyph, accent, art } = meta.cover;
  const id = `g-${meta.id}`;
  return (
    <svg className="cover-svg" viewBox="0 0 160 120" aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="160" height="120" fill={`url(#${id})`} />
      <text x="150" y="112" textAnchor="end" fontSize="64" fill="rgba(255,255,255,0.06)" fontFamily='"Songti SC","STSong",serif' fontWeight="700">
        {glyph}
      </text>
      <g filter={`url(#${id}-glow)`} stroke={accent} fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {ART[art ?? ''] ?? <circle cx="80" cy="60" r="24" />}
      </g>
    </svg>
  );
}

const ART: Record<string, JSX.Element> = {
  box: (
    <>
      <path d="M58 48h40v30H58z" fill="rgba(57,255,122,0.35)" />
      <path d="M58 48l14-12h40l-14 12M98 48l14-12v30l-14 12" fill="rgba(255,63,164,0.3)" stroke="#fff" />
      <path d="M58 48h40v30H58z" stroke="#fff" />
      <circle cx="52" cy="82" r="4" stroke="#39ff7a" />
      <circle cx="118" cy="32" r="4" stroke="#39ff7a" />
    </>
  ),
  shatter: (
    <>
      <path d="M30 40l18 8 10-6 14 14 12-4 16 12 20-6" stroke="#fff" />
      <path d="M58 42l-4-12M84 52l6-14M100 64l2 14" stroke="#bfffe8" strokeWidth="1" />
      <path d="M20 100h120M40 92l-30 20M80 92v20M120 92l30 20M30 96h100" stroke="#39ff7a" strokeWidth="0.8" opacity="0.8" />
      <path d="M62 70l8 6-6 6zM96 78l10 2-4 8z" stroke="#bfffe8" fill="rgba(191,255,232,0.2)" />
    </>
  ),
  heart: (
    <>
      <path d="M80 86C56 70 50 56 56 46c6-9 18-8 24 2 6-10 18-11 24-2 6 10 0 24-24 40z" stroke="#ff4fa8" strokeWidth="2.4" />
      <path d="M118 30l2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1z" stroke="#ffd36b" fill="rgba(255,211,107,0.5)" />
      <path d="M38 30l1.5 3.5 3.5.5-2.5 2.5.5 3.5-3-2-3 2 .5-3.5L33 34l3.5-.5z" stroke="#ffd36b" />
      <path d="M30 96c10-6 20 6 30 0s20 6 30 0 20 6 30 0" stroke="#9fd8ff" strokeWidth="1" />
    </>
  ),
  flower: (
    <>
      <path d="M56 40h48v48H56z" stroke="#fff" />
      <path d="M56 40l12-10h48l-12 10M104 40l12-10v48l-12 10" stroke="rgba(255,255,255,0.6)" />
      <circle cx="80" cy="62" r="4" stroke="#ffd36b" />
      <path d="M80 58c-6-10 6-10 0 0M84 62c10-6 10 6 0 0M80 66c6 10-6 10 0 0M76 62c-10 6-10-6 0 0" stroke="#ff9ccc" strokeWidth="2" />
      <path d="M80 70v14" stroke="#4fd18a" />
      <circle cx="30" cy="30" r="1" /><circle cx="130" cy="96" r="1.2" /><circle cx="128" cy="24" r="0.8" /><circle cx="24" cy="92" r="1" />
    </>
  ),
};

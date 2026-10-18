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
  bowl: (
    <>
      <ellipse cx="80" cy="62" rx="36" ry="12" />
      <path d="M44 62c0 26 72 26 72 0" fill="rgba(240,207,136,0.25)" />
      <ellipse cx="80" cy="62" rx="22" ry="7" stroke="#9ff0d8" strokeWidth="1" />
      <ellipse cx="80" cy="62" rx="12" ry="4" stroke="#9ff0d8" strokeWidth="0.8" />
      <path d="M118 40a40 40 0 0 1 0 44M126 34a50 50 0 0 1 0 56" strokeWidth="1" opacity="0.6" />
    </>
  ),
  fish: (
    <>
      <path d="M52 66c0-22 54-26 58 0 2 14-14 18-30 18s-28-4-28-18z" fill="rgba(216,130,60,0.35)" />
      <path d="M58 68q22 10 46-2" stroke="#2a0f04" />
      <circle cx="66" cy="58" r="2" fill="#2a0f04" /><circle cx="96" cy="58" r="2" fill="#2a0f04" />
      <path d="M112 30l-14 24" strokeWidth="2.5" /><circle cx="113" cy="28" r="4" />
      <text x="118" y="56" fontSize="9" fill="#f3e2b0" stroke="none">+1</text>
    </>
  ),
  tea: (
    <>
      <path d="M60 70q0 16 20 16t20-16z" fill="rgba(194,122,44,0.35)" />
      <ellipse cx="80" cy="70" rx="20" ry="5" />
      <path d="M72 58c-4-6 4-8 0-14M82 58c-4-6 4-8 0-14M92 58c-4-6 4-8 0-14" stroke="#eee" strokeWidth="1" opacity="0.7" />
      <path d="M40 40q10-8 20 0l10-4" stroke="#bbb" />
    </>
  ),
  vase: (
    <>
      <path d="M74 52c-12 6-12 20-6 34h24c6-14 6-28-6-34z" fill="rgba(95,140,124,0.5)" stroke="#3f6b55" />
      <path d="M80 52c-6-16-18-24-26-30M80 52c4-14 14-22 30-26M80 52v-30" stroke="#2b1d14" strokeWidth="1.4" />
      <circle cx="56" cy="24" r="3" fill="#e8475a" stroke="none" /><circle cx="108" cy="27" r="3" fill="#e8475a" stroke="none" /><circle cx="80" cy="22" r="4" fill="#f2b630" stroke="none" />
    </>
  ),
  vinyl: (
    <>
      <circle cx="74" cy="62" r="34" fill="rgba(0,0,0,0.5)" />
      <circle cx="74" cy="62" r="26" strokeWidth="0.6" opacity="0.5" /><circle cx="74" cy="62" r="18" strokeWidth="0.6" opacity="0.5" />
      <circle cx="74" cy="62" r="10" fill="rgba(216,180,106,0.6)" />
      <path d="M124 24l-14 40" stroke="#ddd" strokeWidth="2" /><circle cx="124" cy="24" r="4" />
    </>
  ),
  tape: (
    <>
      <rect x="40" y="36" width="80" height="50" rx="6" fill="rgba(233,225,207,0.15)" />
      <rect x="56" y="54" width="48" height="18" rx="9" />
      <circle cx="66" cy="63" r="6" /><circle cx="94" cy="63" r="6" />
      <circle cx="128" cy="40" r="3" fill="#ff3b30" stroke="none" />
    </>
  ),
  ink: (
    <>
      <path d="M30 80c20-30 40-30 56-10s34 6 46-20" stroke="#1a1714" strokeWidth="6" opacity="0.85" />
      <path d="M40 40c14 6 20 20 40 14" stroke="#b82824" strokeWidth="3" opacity="0.8" />
      <circle cx="118" cy="86" r="5" fill="#1a1714" stroke="none" /><circle cx="128" cy="80" r="2" fill="#1a1714" stroke="none" />
    </>
  ),
  cards: (
    <>
      <rect x="44" y="36" width="30" height="48" rx="3" transform="rotate(-14 59 60)" fill="rgba(27,42,38,0.9)" />
      <rect x="66" y="32" width="30" height="48" rx="3" fill="rgba(231,239,224,0.9)" stroke="#d8b46a" />
      <rect x="88" y="36" width="30" height="48" rx="3" transform="rotate(14 103 60)" fill="rgba(27,42,38,0.9)" />
      <text x="81" y="62" fontSize="12" textAnchor="middle" fill="#2f4a32" stroke="none" fontFamily="serif">立春</text>
    </>
  ),
  fudai: (
    <>
      <path d="M70 34q-14 10-12 26 2 14 22 14t22-14q2-16-12-26z" fill="rgba(214,51,42,0.7)" stroke="#f2c14e" />
      <text x="80" y="64" fontSize="16" textAnchor="middle" fill="#f2c14e" stroke="none" fontFamily="serif">福</text>
      <path d="M50 96h60l-8 14H58z" stroke="#b7853f" fill="rgba(183,133,63,0.4)" />
      <path d="M118 30l6 10M36 44l6-4" />
    </>
  ),
  tangyuan: (
    <>
      <circle cx="60" cy="50" r="10" fill="rgba(255,255,255,0.85)" stroke="none" />
      <circle cx="96" cy="40" r="8" fill="rgba(255,243,196,0.9)" stroke="none" />
      <circle cx="112" cy="70" r="9" fill="rgba(255,255,255,0.8)" stroke="none" />
      <ellipse cx="78" cy="86" rx="14" ry="10" stroke="#5fe3b0" />
    </>
  ),
  dress: (
    <>
      <ellipse cx="80" cy="56" rx="18" ry="22" fill="rgba(255,255,255,0.08)" />
      <path d="M62 50q0-28 36 0" fill="#15110f" stroke="none" />
      <ellipse cx="80" cy="30" rx="10" ry="7" fill="#15110f" stroke="none" />
      <path d="M66 32l30-6" stroke="#e8c36a" />
      <path d="M50 100q30-30 60 0" fill="rgba(184,42,42,0.7)" stroke="none" />
      <path d="M72 82l16 18M88 82l-12 18" stroke="#f0d48a" strokeWidth="2.5" />
    </>
  ),
};

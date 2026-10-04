// A gallery photo — or, when no photo is uploaded yet, a drawn placeholder in the club style.

export const MEDIA_CATEGORIES = [
  ['events', 'Events'],
  ['builds', 'Builds'],
  ['competitions', 'Competitions'],
  ['workshops', 'Workshops'],
  ['lab', 'The lab'],
];

// wireframe glyph drawn on tiles that have no photo yet
const GLYPH = {
  events: 'M8 6h32v32H8zM8 14h32M16 4v6M32 4v6M14 22h6M24 22h6M14 30h6',
  builds: 'M6 34h36M10 34v-8h28v8M14 26v-6h20v6M12 38a3 3 0 1 0 6 0a3 3 0 1 0-6 0M30 38a3 3 0 1 0 6 0a3 3 0 1 0-6 0M24 20V10h8',
  competitions: 'M16 6h16v12a8 8 0 0 1-16 0zM16 10H9v4a6 6 0 0 0 7 6M32 10h7v4a6 6 0 0 1-7 6M24 26v8M17 40h14',
  workshops: 'M8 10h32v20H8zM18 36h12M24 30v6M14 18l5 4-5 4M24 26h8',
  lab: 'M18 6h12M20 6v12L10 38a3 3 0 0 0 3 4h22a3 3 0 0 0 3-4L28 18V6M15 30h18',
};

export function Tile({ m, i = 0, fit = 'cover' }) {
  if (m.url) {
    return <img src={m.url} alt={m.title} loading="lazy" className="absolute inset-0 h-full w-full transition-transform duration-700 group-hover:scale-110" style={{ objectFit: fit }} />;
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: `linear-gradient(160deg, hsl(${210 + (i % 6) * 5} 55% ${15 + (i % 4) * 3}%), #050810)` }}>
      <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-110" style={{ background: 'radial-gradient(60% 60% at 40% 30%, rgba(110,178,255,.18), transparent)' }} />
      <svg className="relative h-16 w-16 opacity-60 transition-transform duration-700 group-hover:scale-110" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d={GLYPH[m.category] || GLYPH.lab} stroke="var(--blue-glow)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}


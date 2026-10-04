/**
 * Renders the tiny write-up format used for project and event stories:
 *   "## Heading"   →  a heading
 *   "- item"       →  a bullet (consecutive ones form a list)
 *   blank line     →  new paragraph
 * Plain text only — nothing in it is treated as HTML, so pasted content is always safe.
 */
export default function RichText({ text = '', className = '' }) {
  const blocks = [];
  let list = null;
  for (const raw of String(text).split('\n')) {
    const line = raw.trim();
    if (!line) {
      list = null;
      continue;
    }
    if (line.startsWith('## ')) {
      list = null;
      blocks.push({ type: 'h', text: line.slice(3) });
    } else if (line.startsWith('- ')) {
      if (!list) blocks.push((list = { type: 'ul', items: [] }));
      list.items.push(line.slice(2));
    } else {
      list = null;
      blocks.push({ type: 'p', text: line });
    }
  }
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {blocks.map((b, i) =>
        b.type === 'h' ? (
          <h3 key={i} className="display mt-4 text-xl font-bold md:text-2xl">
            {b.text}
          </h3>
        ) : b.type === 'ul' ? (
          <ul key={i} className="flex flex-col gap-2.5">
            {b.items.map((it, j) => {
              const k = it.indexOf(': ');
              const label = k > 0 && k < 48 ? it.slice(0, k) : '';
              return (
                <li key={j} className="flex gap-3 text-[15px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                  <span className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--blue)' }} />
                  <span>
                    {label && <strong style={{ color: 'var(--fg)' }}>{label}: </strong>}
                    {label ? it.slice(k + 2) : it}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p key={i} className="text-[15px] leading-relaxed" style={{ color: 'var(--muted)' }}>
            {b.text}
          </p>
        ),
      )}
    </div>
  );
}

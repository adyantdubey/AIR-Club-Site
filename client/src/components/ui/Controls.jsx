// Shared control widgets for machine panels and AI labs. DOM only, theme tokens only.

export function Row({ children, className = '' }) {
  return <div className={`flex flex-wrap items-center gap-2 ${className}`}>{children}</div>;
}

export function Slider({ label, min = 0, max = 1, step = 0.01, value, onChange, format = (v) => v }) {
  return (
    <label className="block">
      <div className="mono mb-1 flex justify-between text-[10px] tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
        <span>{label.toUpperCase()}</span>
        <span style={{ color: 'var(--blue-glow)' }}>{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="ctl-range w-full"
      />
    </label>
  );
}

export function Btn({ children, onClick, primary = false, small = false, disabled = false, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`ctl-btn ${primary ? 'primary' : ''} ${small ? 'small' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

export function Toggle({ label, value, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between py-1"
    >
      <span className="mono text-[10px] tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
        {label.toUpperCase()}
      </span>
      <span
        className="relative h-4 w-8 rounded-full transition-colors"
        style={{ background: value ? 'var(--blue)' : 'rgba(110,178,255,.18)' }}
      >
        <span
          className="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform"
          style={{ left: 2, transform: value ? 'translateX(16px)' : 'translateX(0)' }}
        />
      </span>
    </button>
  );
}

export function Readout({ label, value, unit = '' }) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className="mono text-[10px] tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
        {label.toUpperCase()}
      </span>
      <span className="mono text-sm" style={{ color: 'var(--fg)' }}>
        {value}
        <span style={{ color: 'var(--muted)' }}> {unit}</span>
      </span>
    </div>
  );
}

/** Segmented choice: <Seg options={[['linear','Linear'],['rbf','RBF']]} value onChange /> */
export function Seg({ options, value, onChange, label }) {
  return (
    <div>
      {label && (
        <div className="mono mb-1 text-[10px] tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
          {label.toUpperCase()}
        </div>
      )}
      <div className="flex gap-1 rounded-lg p-1" style={{ background: 'rgba(110,178,255,.08)' }}>
        {options.map(([k, l]) => (
          <button
            key={k}
            onClick={() => onChange(k)}
            className="mono flex-1 rounded-md px-2 py-1 text-[10px] tracking-[0.12em] transition-colors"
            style={value === k ? { background: 'var(--blue)', color: '#fff' } : { color: 'var(--muted)' }}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Tiny sparkline: values array (newest last). */
export function MiniGraph({ values = [], max, min = 0, color = 'var(--blue-glow)', height = 44, label }) {
  const w = 240;
  const h = height;
  const mx = max ?? Math.max(1e-6, ...values);
  const mn = min ?? Math.min(...values);
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * w;
      const y = h - ((v - mn) / (mx - mn || 1)) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <div>
      {label && (
        <div className="mono mb-1 text-[10px] tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
          {label.toUpperCase()}
        </div>
      )}
      <svg viewBox={`0 0 ${w} ${h}`} className="h-11 w-full" preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="rgba(110,178,255,.15)" strokeWidth="1" />
        {values.length > 1 && <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
      </svg>
    </div>
  );
}

/** On-screen d-pad for touch devices. Calls onKey(key, isDown). */
export function DPad({ keys = ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'], action, onKey }) {
  const press = (k) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      onKey(k, true);
    },
    onPointerUp: () => onKey(k, false),
    onPointerLeave: () => onKey(k, false),
    onPointerCancel: () => onKey(k, false),
  });
  const glyph = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', w: '↑', s: '↓', a: '←', d: '→', ' ': '●' };
  return (
    <div className="flex items-center gap-4 select-none">
      <div className="grid grid-cols-3 gap-1">
        <span />
        <button className="ctl-btn small" {...press(keys[0])}>{glyph[keys[0]] || keys[0]}</button>
        <span />
        <button className="ctl-btn small" {...press(keys[1])}>{glyph[keys[1]] || keys[1]}</button>
        <button className="ctl-btn small" {...press(keys[2])}>{glyph[keys[2]] || keys[2]}</button>
        <button className="ctl-btn small" {...press(keys[3])}>{glyph[keys[3]] || keys[3]}</button>
      </div>
      {action && (
        <button className="ctl-btn primary" {...press(action)}>
          {glyph[action] || action}
        </button>
      )}
    </div>
  );
}

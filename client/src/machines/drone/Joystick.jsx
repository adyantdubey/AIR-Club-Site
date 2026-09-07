import { useEffect, useRef } from 'react';

/**
 * A small 2D joystick pad (DOM only). Drag the knob; it springs back to the centre on release.
 * Writes the stick position into `state.frame.stick = { x, y }` (each -1..1, y = +1 means "forward").
 * No React state per move: the knob is moved with a ref + CSS transform.
 */
const SIZE = 120; // px, whole pad
const KNOB = 34; // px, knob diameter
const RADIUS = (SIZE - KNOB) / 2; // how far the knob may travel from the centre

export default function Joystick({ state, disabled = false }) {
  const pad = useRef(null);
  const knob = useRef(null);
  const cur = useRef({ x: 0, y: 0 }); // knob offset in -1..1 (screen y: down is +)
  const raf = useRef(0);

  // Move the knob visually and publish the stick value (y flipped so "up" = forward)
  const apply = (x, y) => {
    cur.current.x = x;
    cur.current.y = y;
    if (knob.current) knob.current.style.transform = `translate(${x * RADIUS}px, ${y * RADIUS}px)`;
    state.frame.stick = { x, y: -y };
  };

  // Spring back: shrink the offset a little each animation frame until it is ~0
  const springHome = () => {
    cancelAnimationFrame(raf.current);
    const step = () => {
      const { x, y } = cur.current;
      if (Math.hypot(x, y) < 0.01) return apply(0, 0);
      apply(x * 0.78, y * 0.78);
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const fromEvent = (e) => {
    const r = pad.current.getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / RADIUS;
    let y = (e.clientY - (r.top + r.height / 2)) / RADIUS;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    apply(x, y);
  };

  const onDown = (e) => {
    if (disabled) return;
    e.preventDefault();
    cancelAnimationFrame(raf.current);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    fromEvent(e);
  };
  const onMove = (e) => {
    if (disabled || !e.currentTarget.hasPointerCapture?.(e.pointerId)) return;
    fromEvent(e);
  };
  const onUp = (e) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    springHome();
  };

  return (
    <div>
      <div className="mono mb-1 text-[10px] tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
        STICK · PITCH / ROLL
      </div>
      <div
        ref={pad}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative select-none rounded-xl"
        style={{
          width: SIZE,
          height: SIZE,
          touchAction: 'none',
          background: 'rgba(110,178,255,.06)',
          border: '1px solid var(--line)',
          opacity: disabled ? 0.45 : 1,
          cursor: disabled ? 'default' : 'grab',
        }}
        aria-label="Joystick: drag to tilt the drone"
        role="slider"
      >
        {/* cross-hair guides */}
        <div className="absolute left-1/2 top-2 bottom-2 w-px" style={{ background: 'var(--line)' }} />
        <div className="absolute top-1/2 left-2 right-2 h-px" style={{ background: 'var(--line)' }} />
        <div
          className="absolute rounded-full"
          style={{
            left: '50%',
            top: '50%',
            width: SIZE * 0.72,
            height: SIZE * 0.72,
            marginLeft: -SIZE * 0.36,
            marginTop: -SIZE * 0.36,
            border: '1px dashed var(--line)',
          }}
        />
        {/* the knob */}
        <div
          ref={knob}
          className="absolute rounded-full"
          style={{
            left: '50%',
            top: '50%',
            width: KNOB,
            height: KNOB,
            marginLeft: -KNOB / 2,
            marginTop: -KNOB / 2,
            background: 'var(--blue)',
            boxShadow: '0 0 0 1px var(--blue-glow), 0 0 14px rgba(45,123,255,.6)',
            transition: 'none',
          }}
        />
      </div>
    </div>
  );
}

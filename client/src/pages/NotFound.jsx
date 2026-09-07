import { TLink } from '../transitions/PageWipe';

export default function NotFound() {
  return (
    <section className="section flex min-h-screen flex-col items-center justify-center text-center">
      <div className="mono text-xs tracking-[0.3em]" style={{ color: 'var(--blue-glow)' }}>
        ERROR 404
      </div>
      <h1 className="display mt-4 text-5xl font-bold">Lost in the lab.</h1>
      <p className="mt-3 max-w-[420px]" style={{ color: 'var(--muted)' }}>
        That page doesn't exist. The rover has been dispatched to look for it.
      </p>
      <TLink to="/" className="btn mt-8">
        <span className="btn-fill" />
        Back home
      </TLink>
    </section>
  );
}

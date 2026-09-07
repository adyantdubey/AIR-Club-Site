import { createContext, forwardRef, useCallback, useContext, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { animate, svg } from 'animejs';
import { gsap, ScrollTrigger } from '../lib/gsap';
import { getLenis } from '../lib/lenis';

/**
 * G9 — page transition. A black panel wipes up, the destination's wireframe icon draws,
 * the route changes, the panel wipes away.
 *
 *   const go = useWipeNavigate();  go('/robotics/arm')
 *   <TLink to="/ai">AI Lab</TLink>
 */
const WipeCtx = createContext(() => {});
export const useWipeNavigate = () => useContext(WipeCtx);

const ICONS = {
  robotics: 'M8 40h48M14 40v-8h36v8M20 32v-6h24v6M12 44a4 4 0 1 0 8 0a4 4 0 1 0-8 0M28 44a4 4 0 1 0 8 0a4 4 0 1 0-8 0M44 44a4 4 0 1 0 8 0a4 4 0 1 0-8 0M30 26V14h12',
  ai: 'M12 20a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 44a4 4 0 1 0 8 0a4 4 0 1 0-8 0M28 32a4 4 0 1 0 8 0a4 4 0 1 0-8 0M44 20a4 4 0 1 0 8 0a4 4 0 1 0-8 0M44 44a4 4 0 1 0 8 0a4 4 0 1 0-8 0M20 20l8 12M20 44l8-12M36 32l8-12M36 32l8 12',
  home: 'M32 4 56 18v28L32 60 8 46V18zM32 23v18M23 32h18',
};

export function PageWipeProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const panel = useRef(null);
  const icon = useRef(null);
  const busy = useRef(false);
  const first = useRef(true);

  const go = useCallback(
    (to) => {
      if (busy.current || to === location.pathname) return;
      busy.current = true;
      const kind = to.startsWith('/robotics') ? 'robotics' : to.startsWith('/ai') ? 'ai' : 'home';
      icon.current.querySelector('path').setAttribute('d', ICONS[kind]);
      getLenis()?.stop();
      const tl = gsap.timeline({
        onComplete: () => {
          busy.current = false;
        },
      });
      tl.set(panel.current, { display: 'block', yPercent: 100 })
        .to(panel.current, { yPercent: 0, duration: 0.55, ease: 'expo.inOut' })
        .call(() => {
          animate(svg.createDrawable(icon.current.querySelector('path')), { draw: ['0 0', '0 1'], duration: 500, ease: 'inOutQuad' });
        })
        .to({}, { duration: 0.45 })
        .call(() => {
          navigate(to);
          window.scrollTo(0, 0);
          getLenis()?.scrollTo(0, { immediate: true });
        })
        .to({}, { duration: 0.15 })
        .call(() => ScrollTrigger.refresh())
        .to(panel.current, { yPercent: -100, duration: 0.6, ease: 'expo.inOut' })
        .set(panel.current, { display: 'none' })
        .call(() => getLenis()?.start());
    },
    [navigate, location.pathname],
  );

  // Back/forward buttons: no wipe, just reset scroll and refresh
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!busy.current) {
      window.scrollTo(0, 0);
      getLenis()?.scrollTo(0, { immediate: true });
      setTimeout(() => ScrollTrigger.refresh(), 50);
    }
  }, [location.pathname]);

  return (
    <WipeCtx.Provider value={go}>
      {children}
      <div
        ref={panel}
        className="fixed inset-0 z-[95] hidden"
        style={{ background: 'var(--bg)', borderTop: '1px solid var(--blue)', boxShadow: '0 -20px 60px rgba(45,123,255,.25)' }}
        aria-hidden="true"
      >
        <div className="flex h-full w-full items-center justify-center">
          <svg ref={icon} width="96" height="96" viewBox="0 0 64 64" fill="none">
            <path d={ICONS.home} stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </WipeCtx.Provider>
  );
}

/** Link that uses the wipe transition. Use exactly like <a href>. */
export const TLink = forwardRef(function TLink({ to, children, onClick, ...rest }, ref) {
  const go = useWipeNavigate();
  return (
    <a
      ref={ref}
      href={to}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        onClick?.(e);
        go(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
});

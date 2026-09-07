import { useEffect } from 'react';
import { animate, utils } from 'animejs';
import { useInView } from './useInView';

// Counts a number up from 0 to `to` when the element scrolls into view.
export function useCounter(ref, to, { duration = 1600, suffix = '' } = {}) {
  const inView = useInView(ref, 0.5);
  useEffect(() => {
    if (!inView || !ref.current) return;
    const obj = { v: 0 };
    const anim = animate(obj, {
      v: to,
      duration,
      ease: 'outExpo',
      modifier: utils.round(0),
      onUpdate: () => {
        if (ref.current) ref.current.textContent = `${obj.v}${suffix}`;
      },
    });
    return () => anim.cancel();
  }, [inView, ref, to, duration, suffix]);
}

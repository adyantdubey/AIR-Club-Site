import { useEffect, useState } from 'react';

/**
 * An image that never shows a broken-picture icon.
 *
 * Club photos are still served from Google Drive, which sometimes refuses when many are
 * requested at once. So a failed load is tried again twice (after 1.5 s and 4 s); if it
 * still fails, `fallback` is shown instead.
 */
const WAITS = [1500, 4000];

export default function SafeImg({ src, alt = '', className = '', style, fallback = null }) {
  const [tries, setTries] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setTries(0);
    setFailed(false);
  }, [src]);

  if (!src || failed) return fallback;

  const onError = () => {
    if (tries >= WAITS.length) return setFailed(true);
    setTimeout(() => setTries((t) => t + 1), WAITS[tries]);
  };
  // the extra "#try" only changes React's key, so the browser asks for the same picture again
  return <img key={tries} src={src} alt={alt} className={className} style={style} loading="lazy" referrerPolicy="no-referrer" onError={onError} />;
}

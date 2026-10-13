import { useEffect, useState } from 'react';
// Keep records paginated within the space left by navigation and filters.
export function usePageSize(maximum, kind) {
  const measure = () => {
    const mobile = window.innerWidth <= 640;
    const reserved = kind === 'sensor' ? (mobile ? 345 : 320) : mobile ? 260 : 270;
    return Math.max(
      1,
      Math.min(maximum, Math.floor((window.innerHeight - reserved) / (mobile ? 48 : 56))),
    );
  };
  const [size, setSize] = useState(measure);
  useEffect(() => {
    const resize = () => setSize(measure());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [maximum, kind]);
  return size;
}

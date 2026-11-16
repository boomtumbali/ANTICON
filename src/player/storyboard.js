import { useEffect, useState } from 'react';

/*
 * Storyboards: Mux publishes, for every film, one image holding a grid of
 * frames from across the film, and a JSON index (when each frame starts,
 * where it sits in the grid). One download gives the scrub strip every
 * frame it can show. Loaded once per address and kept.
 */
const cache = new Map();

export function loadStoryboard(url) {
  if (!url) return Promise.resolve(null);
  if (!cache.has(url)) {
    const p = fetch(url, { mode: 'cors' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(
        (sb) =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.decoding = 'async';
            img.onload = () => resolve({ ...sb, w: img.naturalWidth, h: img.naturalHeight, tiles: [...sb.tiles].sort((a, b) => a.start - b.start) });
            img.onerror = reject;
            img.src = sb.url;
          }),
      )
      .catch(() => {
        cache.delete(url); // try again another time
        return null;
      });
    cache.set(url, p);
  }
  return cache.get(url);
}

/** The storyboard for a film, fetched a moment after it starts so it never competes with the first frames. */
export function useStoryboard(url, delay = 1200) {
  const [sb, setSb] = useState(null);
  useEffect(() => {
    setSb(null);
    if (!url) return undefined;
    let live = true;
    const id = setTimeout(() => loadStoryboard(url).then((d) => live && setSb(d)), delay);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [url, delay]);
  return sb;
}

/** Which frame of the storyboard holds time t, and how far through it t is (0..1). */
export function frameAt(sb, t) {
  const tiles = sb.tiles;
  let lo = 0;
  let hi = tiles.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (tiles[mid].start <= t) lo = mid;
    else hi = mid - 1;
  }
  const start = tiles[lo].start;
  const end = tiles[lo + 1]?.start ?? sb.duration ?? start + 1;
  return { i: lo, f: end > start ? Math.min(1, Math.max(0, (t - start) / (end - start))) : 0 };
}

import { FILMS, LOCAL } from './films.js';
import { loadStoryboard } from './player/storyboard.js';
import { storyboardOf } from './films.js';

/*
 * Warming: before a film is asked for, open the way to it. Fetch its stream's
 * first playlist (small; it also opens the connection to Mux's CDN and puts
 * the playlist in its cache), its blurred still, and later its storyboard.
 * Called when you point at a film on the start page, and for the next film
 * while one plays. Each film is warmed once.
 */
const warmed = new Set();
const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 300));

export function warmFilm(film, { storyboard = false } = {}) {
  if (!film || LOCAL) return;
  if (!warmed.has(film.id)) {
    warmed.add(film.id);
    fetch(`https://stream.mux.com/${film.playbackId}.m3u8`, { mode: 'cors', credentials: 'omit' }).catch(() => {});
    const im = new Image();
    im.src = ambientOf(film);
  }
  if (storyboard) idle(() => loadStoryboard(storyboardOf(film)));
}

/** The small still behind a fitted film: it is blurred to nothing, so it can be tiny. */
export const ambientOf = (film) => (LOCAL ? film.poster : `https://image.mux.com/${film.playbackId}/thumbnail.webp?width=240`);

export const next = (i) => FILMS[(i + 1) % FILMS.length];

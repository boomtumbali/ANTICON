/**
 * The ten films, newest first: the order the feed plays them in. Blender open movies,
 * hosted on Mux. `studio` and `year` are what the edge of the screen says.
 */
export const FILMS = [
  { id: 'singularity', title: 'Singularity', year: 2026, playbackId: 'RDcoT6YoR50200luF01So73Qbo3X5EtIq01l5xkggH02JqBg' },
  { id: 'charge', title: 'Charge', year: 2022, playbackId: 'Awbo3E8JEE019qp8YpGCzehDZgziuLT00agsclSQGk00LU' },
  { id: 'sprite-fright', title: 'Sprite Fright', year: 2021, playbackId: 'n023uDxWiI5UtuxgFWAmRw00gWsM8Fvou00EGc1i0100DDhg' },
  { id: 'coffee-run', title: 'Coffee Run', year: 2020, playbackId: 'o4Z95SSAKjg6T01fdL5nLpRyDHRFIDCV2ONVYUO9Wk02I' },
  { id: 'spring', title: 'Spring', year: 2019, playbackId: 'Nv02v7p74VVEzVZDJAANZVCt7Fo301WVzEV6cRZl9FkmA' },
  { id: 'hero', title: 'Hero', year: 2018, playbackId: 'sSejV89gROKnDWXJDrJ7leEBJpHYEUszl00CeAt002W5U' },
  { id: 'agent-327', title: 'Agent 327', subtitle: 'Operation Barbershop', year: 2017, playbackId: 'ZxfF00WOY01PUbexSBsMWOzLRTFX98w5f1vlPDaoKApTs' },
  { id: 'tears-of-steel', title: 'Tears of Steel', year: 2012, playbackId: 'lfKZJvErJYDJkj02PN4CYtF01EO1KvzyDH2yb9aa2wxIA' },
  { id: 'sintel', title: 'Sintel', year: 2010, playbackId: 'hGaSJz600pALIeT013jSNymH02ekj9HlmJTST8xbjrAI700' },
  { id: 'elephants-dream', title: 'Elephants Dream', year: 2006, playbackId: 'rdxZd5tlzr02nqLJJua9Jpq2sij009WlFBkFfxTInYRe4' },
].map((f, i) => ({ ...f, n: i + 1, studio: 'Blender Studio', poster: `/posters/${f.id}.webp` }));

/** A still from the film, from Mux (the middle of the film unless a time is given). Mux sizes it on its CDN. */
export const stillOf = (film, width = 1600) => `https://image.mux.com/${film.playbackId}/thumbnail.webp?width=${width}&fit_mode=preserve`;

/** Dev only: `?local` plays files from public/dev/ instead of Mux (for offline testing). */
export const LOCAL =
  import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('local')
    ? {
        singularity: '/dev/singularity.mp4',
        // ?local&hls: Charge as a three-quality HLS stream, to try the quality word offline
        charge: new URLSearchParams(location.search).has('hls') ? '/dev/hls/charge/master.m3u8' : '/dev/charge.mp4',
        'sprite-fright': '/dev/sprite.mp4',
        'agent-327': '/dev/agent_327.mp4',
      }
    : null;
export const localSrc = (film) => (LOCAL ? LOCAL[film.id] ?? '/dev/sprite.mp4' : null);

/** The film's storyboard: one sprite of 50 frames (100 past fifteen minutes) and where each frame starts. */
export const storyboardOf = (film) =>
  LOCAL ? localSrc(film).replace(/^\/dev\/hls\/([^/]+)\/master\.m3u8$/, '/dev/$1.mp4').replace(/^\/dev\/(.+)\.mp4$/, '/dev/sb/$1.json') : `https://image.mux.com/${film.playbackId}/storyboard.json?format=webp`;

export const pad2 = (n) => String(n).padStart(2, '0');
export function clock(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

/** A still at the size the screen needs: the browser picks from these, and the preloader asks for the same one. */
export const stillSet = (film, sizes) =>
  LOCAL
    ? { src: film.poster, sizes }
    : { src: stillOf(film, 960), srcSet: [480, 720, 960, 1280].map((w) => `${stillOf(film, w)} ${w}w`).join(', '), sizes };
export const LIST_SIZES = '(max-width: 720px) 92vw, 31vw';

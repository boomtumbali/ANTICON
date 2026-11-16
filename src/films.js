/**
 * The ten films, in the order the feed plays them. Blender open movies,
 * hosted on Mux. `studio` and `year` are what the edge of the screen says.
 */
export const FILMS = [
  { id: 'singularity', title: 'Singularity', year: 2026, playbackId: 'RDcoT6YoR50200luF01So73Qbo3X5EtIq01l5xkggH02JqBg' },
  { id: 'sintel', title: 'Sintel', year: 2010, playbackId: 'hGaSJz600pALIeT013jSNymH02ekj9HlmJTST8xbjrAI700' },
  { id: 'hero', title: 'Hero', year: 2018, playbackId: 'sSejV89gROKnDWXJDrJ7leEBJpHYEUszl00CeAt002W5U' },
  { id: 'elephants-dream', title: 'Elephants Dream', year: 2006, playbackId: 'rdxZd5tlzr02nqLJJua9Jpq2sij009WlFBkFfxTInYRe4' },
  { id: 'agent-327', title: 'Agent 327', subtitle: 'Operation Barbershop', year: 2017, playbackId: 'ZxfF00WOY01PUbexSBsMWOzLRTFX98w5f1vlPDaoKApTs' },
  { id: 'tears-of-steel', title: 'Tears of Steel', year: 2012, playbackId: 'lfKZJvErJYDJkj02PN4CYtF01EO1KvzyDH2yb9aa2wxIA' },
  { id: 'charge', title: 'Charge', year: 2022, playbackId: 'Awbo3E8JEE019qp8YpGCzehDZgziuLT00agsclSQGk00LU' },
  { id: 'spring', title: 'Spring', year: 2019, playbackId: 'Nv02v7p74VVEzVZDJAANZVCt7Fo301WVzEV6cRZl9FkmA' },
  { id: 'sprite-fright', title: 'Sprite Fright', year: 2021, playbackId: 'n023uDxWiI5UtuxgFWAmRw00gWsM8Fvou00EGc1i0100DDhg' },
  { id: 'coffee-run', title: 'Coffee Run', year: 2020, playbackId: 'o4Z95SSAKjg6T01fdL5nLpRyDHRFIDCV2ONVYUO9Wk02I' },
].map((f, i) => ({ ...f, n: i + 1, studio: 'Blender Studio', poster: `/posters/${f.id}.webp` }));

/** A still from the film, from Mux (the middle of the film unless a time is given). */
export const stillOf = (film, width = 1600) => `https://image.mux.com/${film.playbackId}/thumbnail.webp?width=${width}&fit_mode=preserve`;

/** Dev only: `?local` plays files from public/dev/ instead of Mux (for offline testing). */
export const LOCAL =
  import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('local')
    ? { singularity: '/dev/singularity.mp4', charge: '/dev/charge.mp4', 'sprite-fright': '/dev/sprite.mp4', 'agent-327': '/dev/agent_327.mp4' }
    : null;
export const localSrc = (film) => (LOCAL ? LOCAL[film.id] ?? '/dev/sprite.mp4' : null);

export const pad2 = (n) => String(n).padStart(2, '0');
export function clock(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

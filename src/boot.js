import { FILMS, LIST_SIZES, stillSet } from './films.js';

/*
 * The preloader's progress is real: the two typefaces, then the stills of
 * the ten films at the size this screen will ask for (or, arriving on a
 * film's link, that film's first frame). The line stops creeping and
 * follows what has actually arrived. It never holds the page longer than
 * a few seconds, and never shorter than it takes to read.
 */
const MIN_MS = 900;
const MAX_MS = 4000;

export function boot({ onFilm }) {
  const pre = document.getElementById('pre');
  const html = document.documentElement;
  if (!pre) {
    html.removeAttribute('data-loading');
    return;
  }
  const t0 = performance.now();
  // take over from the CSS creep without a jump
  // (where the creep had got to; if the browser can't say, the same curve worked out from the time since the page began)
  const read = parseFloat(getComputedStyle(pre).getPropertyValue('--k'));
  const k0 = read > 0.01 ? read : 0.42 * Math.min(1, Math.sqrt(t0 / 5000));
  pre.style.setProperty('--k', String(k0));
  pre.dataset.js = '';

  const tasks = [];
  const add = (p, weight = 1) => tasks.push({ p: Promise.resolve(p).catch(() => {}), weight, done: false });
  add(document.fonts?.load?.('200 100px "Inter Tight Variable"'), 2);
  add(document.fonts?.load?.('400 12px "Geist Mono Variable"'), 1);
  if (onFilm) {
    // a film's link: wait for its first frame
    add(new Promise((res) => window.addEventListener('anticon:ready', res, { once: true })), 4);
  } else {
    for (const f of FILMS) {
      const { src, srcSet, sizes } = stillSet(f, LIST_SIZES);
      add(
        new Promise((res) => {
          const im = new Image();
          im.decoding = 'async';
          im.onload = im.onerror = res;
          if (sizes) im.sizes = sizes;
          if (srcSet) im.srcset = srcSet;
          im.src = src;
        }),
      );
    }
  }
  const total = tasks.reduce((a, t) => a + t.weight, 0);
  let got = 0;
  const show = () => pre.style.setProperty('--k', String(Math.max(k0, k0 + (1 - k0) * (got / total))));
  tasks.forEach((t) =>
    t.p.then(() => {
      got += t.weight;
      show();
    }),
  );

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    pre.style.setProperty('--k', '1');
    // the line reaches the edges, then the screen parts along it
    setTimeout(() => {
      pre.dataset.done = '';
      html.removeAttribute('data-loading');
      setTimeout(() => pre.remove(), 1200);
    }, 420);
  };
  const all = Promise.all(tasks.map((t) => t.p));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  Promise.race([all.then(() => wait(Math.max(0, MIN_MS - (performance.now() - t0)))), wait(MAX_MS)]).then(finish);
}

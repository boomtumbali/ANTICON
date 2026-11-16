import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Video } from '@videojs/react/video';
import { MuxVideo } from '@videojs/react/media/mux-video';
import { MuxData } from '@videojs/react/extensions/mux-data';
import { Player } from './player/core.js';
import { AnticonSkin } from './player/Skin.jsx';
import { FILMS, LOCAL, localSrc, pad2, stillOf } from './films.js';
import { IndexPage, Credits } from './IndexPage.jsx';
import { Landing } from './Landing.jsx';

/*
 * The site: a landing page, then the feed. Nothing plays until you choose a
 * film, press Enter, or scroll to the end of the landing page. A link with a
 * film in it (#sprite-fright) opens the feed at that film.
 *
 * The feed: ten films that never run out (after Coffee Run comes Singularity
 * again, still moving down). It is not a scrolling list: one film is on
 * screen, and a wheel turn, a swipe or a key moves to the next with one
 * timed move. The leaving film freezes on its last frame and lifts away; the
 * next arrives as its title on black, and its picture fades up only once it
 * has a frame to show. No poster, no black flash, no half-loaded film.
 */

const N = FILMS.length;
const mod = (n) => ((n % N) + N) % N;
const filmFromHash = () => {
  const i = FILMS.findIndex((f) => f.id === location.hash.slice(1));
  return i < 0 ? null : i;
};

const useMatch = (q) => {
  const [m, setM] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
};

/** A CSS cubic-bezier as a function (solved by halving: exact enough, never unstable). */
function bezier(x1, y1, x2, y2) {
  const at = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}
const GLIDE = bezier(0.5, 0, 0.12, 1); // a wheel turn or a key: eases out of the frame, glides into the next
const SETTLE = bezier(0.22, 1, 0.36, 1); // a released finger: picks up its speed and settles
const MOVE_MS = 1000;

export default function App() {
  const [entry, setEntry] = useState(filmFromHash); // the film the feed opens on, or null for the landing page
  const [closing, setClosing] = useState(false);
  const open = entry != null;
  useEffect(() => {
    document.documentElement.toggleAttribute('data-feed', open);
  }, [open]);
  useEffect(() => {
    const on = () => {
      const i = filmFromHash();
      if (i != null && entry == null) setEntry(i);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, [entry]);
  const exit = useCallback(() => {
    setClosing(true);
  }, []);
  const closed = useCallback(() => {
    history.replaceState(null, '', location.pathname + location.search);
    setClosing(false);
    setEntry(null);
  }, []);
  return (
    <>
      <Landing hidden={open && !closing} onEnter={(i) => setEntry(i)} />
      {open && (
        <Player>
          <Feed start={entry} closing={closing} onExit={exit} onClosed={closed} />
          {!LOCAL && <MuxData playerSoftwareName="anticon" />}
        </Player>
      )}
    </>
  );
}

function Feed({ start, closing, onExit, onClosed }) {
  const [pos, setPos] = useState(start); // counts on past ten: film = FILMS[mod(pos)]
  const [move, setMove] = useState(null); // { to, dir, live } while a move runs (live: the next film may load)
  const [loop, setLoop] = useState(false);
  const [page, setPage] = useState(null); // 'index' | 'credits' | null
  const [gate, setGate] = useState(false); // the browser started this film silent
  const landscape = useMatch('(min-aspect-ratio: 1/1)');
  const reduced = useMatch('(prefers-reduced-motion: reduce)');
  const fine = useMatch('(pointer: fine)');
  const root = useRef(null);
  const els = useRef(new Map()); // pos -> { root, inner, shade, freeze, edge }
  const raf = useRef(0);
  const busy = useRef(false);
  const times = useRef({}); // where you left each film
  const soundPref = useRef(true); // sound is the default; the browser may say not yet
  const liveP = move ? (move.live ? move.to : null) : pos;
  // the edges name the arriving film as soon as the move is certain
  const film = FILMS[mod(move?.live ? move.to : pos)];

  /* ---------- painting a move: transforms only, so it stays on the compositor ---------- */
  const paint = useCallback(
    (from, to, dir, p) => {
      const A = els.current.get(from);
      const B = els.current.get(to);
      if (!A || !B) return;
      if (reduced) {
        B.root.style.transform = 'none';
        B.inner.style.transform = 'none';
        B.root.style.opacity = String(p);
        return;
      }
      A.root.style.transform = `translate3d(0, ${(-dir * 34 * p).toFixed(3)}%, 0) scale(${(1 - 0.05 * p).toFixed(4)})`;
      A.shade.style.opacity = String(0.72 * p);
      B.root.style.opacity = '1';
      B.root.style.transform = `translate3d(0, ${(dir * 100 * (1 - p)).toFixed(3)}%, 0)`;
      B.inner.style.transform = `translate3d(0, ${(-dir * 66 * (1 - p)).toFixed(3)}%, 0)`;
      B.edge.style.opacity = String(Math.sin(Math.PI * p) * 0.9);
      B.edge.dataset.dir = dir > 0 ? 'up' : 'down';
    },
    [reduced],
  );
  const run = useCallback((from, to, ms, ease, onFrame, done) => {
    cancelAnimationFrame(raf.current);
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      onFrame(from + (to - from) * ease(k));
      if (k < 1) raf.current = requestAnimationFrame(tick);
      else done();
    };
    raf.current = requestAnimationFrame(tick);
  }, []);

  /** Freeze the playing film on its current frame, so it can leave without going black. */
  const freeze = useCallback((p) => {
    const S = els.current.get(p);
    const v = S?.root.querySelector('video');
    if (!S || !v) return;
    times.current[FILMS[mod(p)].id] = v.ended ? 0 : v.currentTime;
    if (v.readyState >= 2 && v.videoWidth) {
      const c = S.freeze;
      const k = Math.min(1, 1920 / v.videoWidth);
      c.width = Math.round(v.videoWidth * k);
      c.height = Math.round(v.videoHeight * k);
      try {
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        c.dataset.on = '';
      } catch {
        /* nothing to draw: the slide shows its title instead */
      }
    }
    v.pause();
  }, []);

  /* ---------- the moves ---------- */
  const moveRef = useRef(null); // the move in progress, for handlers outside React
  const go = useCallback(
    (to, { drag = false } = {}) => {
      if (busy.current || to === pos) return false;
      busy.current = true;
      const dir = to > pos ? 1 : -1;
      freeze(pos);
      moveRef.current = { from: pos, to, dir, p: 0, drag };
      setMove({ to, dir, live: !drag });
      return true;
    },
    [pos, freeze],
  );
  const step = useCallback((d) => go(pos + d), [go, pos]);
  const finish = useCallback(() => {
    const m = moveRef.current;
    moveRef.current = null;
    const B = els.current.get(m.to);
    if (B) {
      B.root.style.transform = '';
      B.root.style.opacity = '';
      B.inner.style.transform = '';
      B.edge.style.opacity = '0';
    }
    setPos(m.to);
    setMove(null);
    busy.current = false;
  }, []);
  const cancel = useCallback(() => {
    const m = moveRef.current;
    moveRef.current = null;
    const A = els.current.get(m.from);
    if (A) {
      A.root.style.transform = '';
      A.shade.style.opacity = '0';
    }
    setMove(null);
    busy.current = false;
  }, []);
  // a timed move starts once both slides are on the page
  useLayoutEffect(() => {
    const m = moveRef.current;
    if (move && m?.drag) {
      paint(m.from, m.to, m.dir, m.p);
      return;
    }
    if (!move || !m || m.started) return;
    m.started = true;
    paint(m.from, m.to, m.dir, 0);
    run(0, 1, reduced ? 380 : MOVE_MS, reduced ? (k) => k : GLIDE, (p) => paint(m.from, m.to, m.dir, p), finish);
  }, [move, paint, run, finish, reduced]);

  /* ---------- the wheel: one film per turn of the wheel or swipe of the trackpad, however long it glides ---------- */
  const live = useRef({});
  live.current = { step, page, go, pos, gate };
  useEffect(() => {
    const el = root.current;
    let acc = 0;
    let last = 0;
    let held = false; // after a move, wait for the wheel to go quiet before the next
    const onWheel = (e) => {
      if (live.current.page || e.ctrlKey) return;
      e.preventDefault();
      const now = performance.now();
      const gap = now - last;
      last = now;
      if (held) {
        if (busy.current || gap < 240) return;
        held = false;
      }
      if (gap > 240) acc = 0;
      // a wheel with notches says so (multiples of 120): one notch is one film
      const notch = e.wheelDeltaY && Math.abs(e.wheelDeltaY) >= 120 && e.wheelDeltaY % 120 === 0;
      acc += e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * el.clientHeight : e.deltaY;
      if (notch || Math.abs(acc) >= 70) {
        const d = (notch ? -e.wheelDeltaY : acc) > 0 ? 1 : -1;
        acc = 0;
        held = true;
        live.current.step(d);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  /* ---------- the finger: the next film follows it, then settles or springs back ---------- */
  const liveDrag = useRef({});
  liveDrag.current = { go, paint, run, finish, cancel, setMove, page, gate };
  useEffect(() => {
    const el = root.current;
    let t = null;
    const down = (e) => {
      if (e.pointerType === 'mouse' || liveDrag.current.page || busy.current) return;
      if (e.target.closest?.('.ac-edges button, .ac-edges [role=slider], .ac-ix, .ac-keys')) return;
      if (t) return; // a second finger: the skin's pinch
      t = { id: e.pointerId, y0: e.clientY, x0: e.clientX, on: false, samples: [[performance.now(), e.clientY]] };
    };
    const moveH = (e) => {
      if (!t || e.pointerId !== t.id) return;
      const dy = e.clientY - t.y0;
      const dx = e.clientX - t.x0;
      if (!t.on) {
        if (Math.abs(dy) < 12 || Math.abs(dy) < Math.abs(dx) * 1.2) return;
        const L = liveDrag.current;
        if (!L.go(live.current.pos + (dy < 0 ? 1 : -1), { drag: true })) {
          t = null;
          return;
        }
        t.on = true;
        t.y0 += Math.sign(dy) * 12;
      }
      const m = moveRef.current;
      if (!m) return;
      const H = el.clientHeight;
      m.p = Math.min(1, Math.max(0, (-(e.clientY - t.y0) * m.dir) / H));
      liveDrag.current.paint(m.from, m.to, m.dir, m.p);
      t.samples.push([performance.now(), e.clientY]);
      if (t.samples.length > 6) t.samples.shift();
    };
    const up = (e) => {
      if (!t || e.pointerId !== t.id) return;
      const was = t;
      t = null;
      if (!was.on) return;
      const m = moveRef.current;
      if (!m) return;
      const L = liveDrag.current;
      // speed over the last moments, in screens per second, along the move
      const [a, b] = [was.samples[0], was.samples[was.samples.length - 1]];
      const v = b && a && b[0] > a[0] ? ((-(b[1] - a[1]) * m.dir) / el.clientHeight) * (1000 / (b[0] - a[0])) : 0;
      const commit = e.type !== 'pointercancel' && (m.p > 0.2 || v > 0.6);
      if (commit) {
        L.setMove((mv) => mv && { ...mv, live: true });
        L.run(m.p, 1, 260 + 560 * (1 - m.p), SETTLE, (p) => L.paint(m.from, m.to, m.dir, p), L.finish);
      } else {
        L.run(m.p, 0, 220 + 380 * m.p, SETTLE, (p) => L.paint(m.from, m.to, m.dir, p), L.cancel);
      }
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', moveH);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', moveH);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, []);

  // Page Up/Down also change film (↑/↓ and N/P are the skin's, given onNext/onPrev)
  useEffect(() => {
    const onKey = (e) => {
      if (live.current.page || e.altKey || e.metaKey || e.ctrlKey) return;
      const d = { PageDown: 1, PageUp: -1 }[e.key];
      if (d) {
        e.preventDefault();
        live.current.step(d);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // the address names the film, so a link opens on it
  useEffect(() => {
    if (!closing) history.replaceState(null, '', `#${FILMS[mod(pos)].id}`);
  }, [pos, closing]);

  /* ---------- arriving from the landing page, and leaving for it ---------- */
  useLayoutEffect(() => {
    const el = root.current;
    if (reduced) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: 'linear' });
    else el.animate([{ transform: 'translate3d(0, 100%, 0)' }, { transform: 'none' }], { duration: 1050, easing: 'cubic-bezier(0.72, 0, 0.18, 1)' });
    el.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!closing) return;
    const el = root.current;
    el.querySelector('video')?.pause();
    const a = reduced
      ? el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' })
      : el.animate([{ transform: 'none' }, { transform: 'translate3d(0, 100%, 0)' }], { duration: 900, easing: 'cubic-bezier(0.72, 0, 0.18, 1)', fill: 'forwards' });
    a.onfinish = onClosed;
  }, [closing, reduced, onClosed]);

  // full screen is the whole page, so the feed keeps working inside it
  const [isFull, setIsFull] = useState(false);
  const canFull = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  useEffect(() => {
    const on = () => setIsFull(!!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', on);
    document.addEventListener('webkitfullscreenchange', on);
    return () => {
      document.removeEventListener('fullscreenchange', on);
      document.removeEventListener('webkitfullscreenchange', on);
    };
  }, []);
  const toggleFull = useCallback(() => {
    const d = document;
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d)?.catch?.(() => {});
    else (d.documentElement.requestFullscreen || d.documentElement.webkitRequestFullscreen).call(d.documentElement)?.catch?.(() => {});
  }, []);

  const closePage = useCallback(() => {
    setPage(null);
    root.current?.focus({ preventScroll: true });
  }, []);

  /* ---------- sound ---------- */
  // called inside a tap, click or key, so the browser lets the film speak
  const openSound = useCallback(() => {
    const v = root.current?.querySelector('video');
    soundPref.current = true;
    setGate(false);
    if (!v) return;
    v.muted = false;
    if (v.volume === 0) v.volume = 1;
    if (v.paused) v.play()?.catch?.(() => {});
  }, []);

  const corner = (
    <span className="ac-corner">
      <span className="ac-mono" aria-label={`Film ${film.n} of ${N}`}>
        {pad2(film.n)} <span className="ac-dim">/ {pad2(N)}</span>
      </span>
      <button type="button" className="ac-link" onClick={() => setPage('index')} aria-haspopup="dialog">
        Index
      </button>
    </span>
  );
  const slides = move ? [pos, move.to] : [pos];

  return (
    <AnticonSkin
      rootRef={root}
      className="ac--page ac--feed"
      title={film.title}
      meta={`${film.year} · ${film.studio}`}
      onTitle={() => setPage('credits')}
      corner={corner}
      brand={
        <button type="button" className="ac-brand" onClick={onExit} aria-label="ANTICON, back to the start">
          ANTICON
        </button>
      }
      below={gate ? <span className="ac-mono ac-gate">{fine ? 'Sound is off · click or press any key' : 'Sound is off · tap anywhere'}</span> : null}
      defaultFill={landscape}
      loop={loop}
      onLoop={setLoop}
      onFullscreen={toggleFull}
      onNext={() => step(1)}
      onPrev={() => step(-1)}
      isFull={isFull}
      canFull={canFull}
      overlay={!!page || closing}
      soundGate={gate}
      onSoundGate={openSound}
      label={`ANTICON, ${film.title}, film ${film.n} of ${N}`}
    >
      <div className="ac-stage" aria-hidden={page ? true : undefined}>
        {slides.map((p) => (
          <Slide
            key={p}
            p={p}
            film={FILMS[mod(p)]}
            front={move ? p === move.to : true}
            playing={p === liveP}
            shown={!move}
            els={els}
            soundPref={soundPref}
            from={times.current[FILMS[mod(p)].id] ?? 0}
            loop={loop}
            onEnded={() => step(1)}
            onSilenced={() => setGate(true)}
            onSound={(on) => {
              soundPref.current = on;
              if (on) setGate(false);
            }}
          />
        ))}
      </div>
      <IndexPage
        open={page === 'index'}
        active={mod(pos)}
        onClose={closePage}
        onHome={() => {
          setPage(null);
          onExit();
        }}
        onPick={(i) => {
          setPage(null);
          const d = mod(i - pos);
          if (d) go(pos + (d <= N / 2 ? d : d - N));
          root.current?.focus({ preventScroll: true });
        }}
      />
      <Credits film={film} open={page === 'credits'} onClose={closePage} />
    </AnticonSkin>
  );
}

/** One film's place in the feed: its title on black, its frozen last frame when it leaves, its picture while it plays. */
function Slide({ p, film, front, playing, shown, els, soundPref, from, loop, onEnded, onSilenced, onSound }) {
  const rootEl = useRef(null);
  const inner = useRef(null);
  const shade = useRef(null);
  const frozen = useRef(null);
  const edge = useRef(null);
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    els.current.set(p, { root: rootEl.current, inner: inner.current, shade: shade.current, freeze: frozen.current, edge: edge.current });
    return () => els.current.delete(p);
  }, [p, els]);
  useEffect(() => {
    if (!playing) setReady(false);
  }, [playing]);
  const visible = playing && ready && shown;
  // once the picture is up, the frozen frame steps aside
  useEffect(() => {
    if (!visible) return undefined;
    const id = setTimeout(() => frozen.current && delete frozen.current.dataset.on, 700);
    return () => clearTimeout(id);
  }, [visible]);
  return (
    <section ref={rootEl} className="ac-slide" data-front={front || undefined} aria-label={`${film.title}, ${film.year}`}>
      <div ref={inner} className="ac-slide-in">
        <img className="ac-ambient" src={LOCAL ? film.poster : stillOf(film, 480)} alt="" aria-hidden="true" decoding="async" />
        <div className="ac-cover" data-gone={visible || undefined} aria-hidden="true">
          <span className="ac-cover-n ac-mono">{pad2(film.n)}</span>
          <span className="ac-cover-t">{film.title}</span>
          {film.subtitle && <span className="ac-cover-s ac-mono">{film.subtitle}</span>}
        </div>
        <canvas ref={frozen} className="ac-freeze" aria-hidden="true" />
        {playing && <Film film={film} visible={visible} soundPref={soundPref} from={from} loop={loop} onReady={() => setReady(true)} onEnded={onEnded} onSilenced={onSilenced} onSound={onSound} />}
      </div>
      <div ref={shade} className="ac-shade" aria-hidden="true" />
      <div ref={edge} className="ac-edge" aria-hidden="true" />
    </section>
  );
}

/** The one film that plays. Hidden until it has a frame to show, then it fades up. */
function Film({ film, visible, soundPref, from, loop, onReady, onEnded, onSilenced, onSound }) {
  const ref = useRef(null);
  const src = localSrc(film);
  const source = useMemo(
    () => ({
      playbackId: film.playbackId,
      preferPlayback: 'mse',
      // start a step lower and climb: the picture arrives sooner, and sharpens within seconds
      engine: { hlsJs: { capLevelOnFPSDrop: false, abrEwmaDefaultEstimate: 2_500_000, startFragPrefetch: true } },
    }),
    [film.playbackId],
  );
  const cb = useRef({});
  cb.current = { onReady, onEnded, onSilenced, onSound, loop };
  const forcing = useRef(false);
  useEffect(() => {
    const v = ref.current;
    if (!v) return undefined;
    let said = false;
    const ready = () => {
      if (said) return;
      said = true;
      cb.current.onReady();
    };
    // a real frame, not just "can play": the first painted frame where the browser offers it
    const onPlaying = () => {
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(() => ready());
      else setTimeout(ready, 60);
    };
    const onMeta = () => {
      if (from > 1 && v.duration && from < v.duration - 2) v.currentTime = from;
    };
    const onVol = () => {
      if (!forcing.current) cb.current.onSound(!v.muted);
    };
    const onEnd = () => !v.loop && cb.current.onEnded();
    // a stream can attach after the first play() call: ask again once it can play, until it has started
    let started = false;
    const onStarted = () => (started = true);
    const onCan = () => !started && v.paused && v.play?.()?.catch?.(() => {});
    v.addEventListener('playing', onStarted);
    v.addEventListener('canplay', onCan);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('volumechange', onVol);
    v.addEventListener('ended', onEnd);
    if (v.readyState >= 1) onMeta();
    // sound first; if the browser refuses, play silent and say so
    forcing.current = true;
    v.muted = !soundPref.current;
    forcing.current = false;
    const tryPlay = v.play?.();
    tryPlay?.catch?.((err) => {
      if (err?.name !== 'NotAllowedError' || v.muted) return;
      forcing.current = true;
      v.muted = true;
      forcing.current = false;
      cb.current.onSilenced();
      v.play?.()?.catch?.(() => {});
    });
    return () => {
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('playing', onStarted);
      v.removeEventListener('canplay', onCan);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('volumechange', onVol);
      v.removeEventListener('ended', onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (ref.current) ref.current.loop = loop;
  }, [loop]);
  const cls = `ac-media ac-film${visible ? ' is-up' : ''}`;
  if (src) return <Video ref={ref} className={cls} src={src} playsInline preload="auto" />;
  return <MuxVideo ref={ref} className={cls} source={source} crossOrigin="anonymous" playsInline preload="auto" />;
}

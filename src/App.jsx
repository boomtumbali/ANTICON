import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Video } from '@videojs/react/video';
import { MuxVideo } from '@videojs/react/media/mux-video';
import { MuxData } from '@videojs/react/extensions/mux-data';
import { Player } from './player/core.js';
import { AnticonSkin } from './player/Skin.jsx';
import { FILMS, LOCAL, localSrc, pad2, stillOf } from './films.js';
import { IndexPage, Credits } from './IndexPage.jsx';

/*
 * The feed: ten films, one per screen, under one ANTICON player. Scroll,
 * swipe or press ↑/↓ and the next film slides in; the skin stays put. The
 * feed only adds what a feed needs: its count and Index in the corner, the
 * next film under the line, Credits behind the title.
 */

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

const startIndex = () => {
  const i = FILMS.findIndex((f) => f.id === location.hash.slice(1));
  return i < 0 ? 0 : i;
};

export default function App() {
  return (
    <Player>
      <Feed />
      {!LOCAL && <MuxData playerSoftwareName="anticon" />}
    </Player>
  );
}

function Feed() {
  const [active, setActive] = useState(startIndex);
  const [soundOn, setSoundOn] = useState(false); // browsers start films muted until you ask for sound
  const [loop, setLoop] = useState(false);
  const [page, setPage] = useState(null); // 'index' | 'credits' | null
  const [moved, setMoved] = useState(false);
  const landscape = useMatch('(min-aspect-ratio: 1/1)');
  const reduced = useMatch('(prefers-reduced-motion: reduce)');
  const fine = useMatch('(pointer: fine)');
  const feed = useRef(null);
  const root = useRef(null);
  const film = FILMS[active];
  const next = FILMS[(active + 1) % FILMS.length];

  const go = useCallback(
    (i, instant) => {
      const el = feed.current;
      if (!el) return;
      const n = (i + FILMS.length) % FILMS.length;
      el.scrollTo({ top: n * el.clientHeight, behavior: reduced || instant ? 'auto' : 'smooth' });
    },
    [reduced],
  );
  const step = useCallback((d) => go(active + d), [go, active]);

  // the slide that fills most of the screen is the one playing
  useEffect(() => {
    const el = feed.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting && e.intersectionRatio >= 0.6) setActive(Number(e.target.dataset.i));
      },
      { root: el, threshold: [0.6] },
    );
    el.querySelectorAll('.ac-slide').forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);
  useLayoutEffect(() => {
    feed.current.scrollTop = active * feed.current.clientHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const first = useRef(true);
  useEffect(() => {
    history.replaceState(null, '', `#${FILMS[active].id}`);
    if (first.current) first.current = false;
    else setMoved(true);
  }, [active]);
  useEffect(() => {
    const on = () => feed.current && (feed.current.scrollTop = active * feed.current.clientHeight);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [active]);

  // a mouse wheel moves one film per turn, however long a trackpad glides
  useEffect(() => {
    const el = feed.current;
    let acc = 0;
    let lockUntil = 0;
    let quiet = 0;
    const onWheel = (e) => {
      if (page || e.ctrlKey) return;
      e.preventDefault();
      const now = performance.now();
      clearTimeout(quiet);
      quiet = setTimeout(() => (acc = 0), 160);
      if (now < lockUntil) {
        lockUntil = now + 140;
        return;
      }
      acc += e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
      if (Math.abs(acc) > 36) {
        step(acc > 0 ? 1 : -1);
        acc = 0;
        lockUntil = now + 650;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [step, page]);

  // Page Up/Down also change film (↑/↓ and N/P are the skin's, given onNext/onPrev)
  useEffect(() => {
    const onKey = (e) => {
      if (page || e.altKey || e.metaKey || e.ctrlKey) return;
      const d = { PageDown: 1, PageUp: -1 }[e.key];
      if (d) {
        e.preventDefault();
        step(d);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, page]);

  // full screen is the whole feed, so scrolling still works inside it
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

  const corner = (
    <span className="ac-corner">
      <span className="ac-mono" aria-label={`Film ${film.n} of ${FILMS.length}`}>
        {pad2(film.n)} <span className="ac-dim">/ {pad2(FILMS.length)}</span>
      </span>
      <button type="button" className="ac-link" onClick={() => setPage('index')} aria-haspopup="dialog">
        Index
      </button>
    </span>
  );
  const below = (
    <button type="button" className="ac-link ac-next" onClick={() => step(1)} aria-label={`Next film: ${next.title}`}>
      {moved ? 'Next' : fine ? 'Scroll for next' : 'Swipe up for next'} <span className="ac-dim">{next.title}</span>
    </button>
  );

  return (
    <AnticonSkin
      rootRef={root}
      className="ac--page"
      title={film.title}
      meta={`${film.year} · ${film.studio}`}
      onTitle={() => setPage('credits')}
      corner={corner}
      brand={<span className="ac-brand">ANTICON</span>}
      below={below}
      defaultFill={landscape}
      loop={loop}
      onLoop={setLoop}
      onFullscreen={toggleFull}
      onNext={() => step(1)}
      onPrev={() => step(-1)}
      isFull={isFull}
      canFull={canFull}
      overlay={!!page}
      autoFocus
      label={`ANTICON, ${film.title}, film ${film.n} of ${FILMS.length}`}
    >
      <div className="ac-feed" ref={feed} aria-hidden={page ? true : undefined}>
        {FILMS.map((f, i) => (
          <section key={f.id} className="ac-slide" data-i={i} aria-label={`${f.title}, ${f.year}`} aria-current={i === active || undefined}>
            <Still film={f} near={Math.abs(i - active) <= 1} />
            {i === active && (
              <Film
                film={f}
                soundOn={soundOn}
                loop={loop}
                onEnded={() => step(1)}
                onSettled={setSoundOn}
              />
            )}
          </section>
        ))}
      </div>
      <TitleCard film={film} key={film.id} />
      <IndexPage open={page === 'index'} active={active} onClose={closePage} onPick={(i) => { setPage(null); go(i, true); root.current?.focus({ preventScroll: true }); }} />
      <Credits film={film} open={page === 'credits'} onClose={closePage} />
    </AnticonSkin>
  );
}

/** The film's still, shown until the film runs (and while it slides in or out). */
function Still({ film, near }) {
  const src = LOCAL ? film.poster : stillOf(film);
  return (
    <>
      <img className="ac-ambient" src={src} alt="" aria-hidden="true" loading={near ? 'eager' : 'lazy'} decoding="async" />
      {/* in local test mode the only picture is a portrait poster, which would show around the film: blur only */}
      {!LOCAL && <img className="ac-still" src={src} alt="" aria-hidden="true" loading={near ? 'eager' : 'lazy'} decoding="async" />}
    </>
  );
}

/** The one film that plays: mounted only in the slide in view, so the page decodes one stream at a time. */
function Film({ film, soundOn, loop, onEnded, onSettled }) {
  const ref = useRef(null);
  const src = localSrc(film);
  const source = useMemo(
    () => ({
      playbackId: film.playbackId,
      preferPlayback: 'mse',
      engine: { hlsJs: { capLevelOnFPSDrop: false, abrEwmaDefaultEstimate: 4_000_000 } },
      poster: { width: 1600 },
    }),
    [film.playbackId],
  );
  // start at once: with sound if you have asked for it (allowed after your first touch), else silent
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = !soundOn;
    v.play?.()
      ?.then?.(() => onSettled(!v.muted))
      .catch?.(() => {
        v.muted = true;
        v.play?.()?.catch?.(() => {});
        onSettled(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // sound you turn on or off follows you to the next film
  useEffect(() => {
    const v = ref.current;
    if (!v) return undefined;
    const on = () => onSettled(!v.muted);
    v.addEventListener('volumechange', on);
    return () => v.removeEventListener('volumechange', on);
  }, [onSettled]);
  // "ended" from this film's own element: the player's state can still say ended for a moment after a new film mounts
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;
  useEffect(() => {
    const v = ref.current;
    if (!v) return undefined;
    v.loop = loop;
    const on = () => !v.loop && endedRef.current();
    v.addEventListener('ended', on);
    return () => v.removeEventListener('ended', on);
  }, [loop]);
  if (src) return <Video ref={ref} className="ac-media" src={src} playsInline preload="auto" muted={!soundOn} />;
  return <MuxVideo ref={ref} className="ac-media" source={source} crossOrigin="anonymous" playsInline preload="auto" muted={!soundOn} />;
}

/** The film's name, large and thin, as it arrives; then it steps back to its corner. */
function TitleCard({ film }) {
  return (
    <div className="ac-card" aria-hidden="true">
      <span className="ac-card-t">{film.title}</span>
      {film.subtitle && <span className="ac-card-s">{film.subtitle}</span>}
    </div>
  );
}

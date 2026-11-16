import { useEffect, useRef, useState } from 'react';
import { FILMS, LIST_SIZES, pad2, stillSet } from './films.js';
import { warmFilm } from './warm.js';
import { BlenderLink, MuxLink, VideoJsLink } from './credits.jsx';
import { SiteHeader } from './SiteHeader.jsx';

/*
 * The start page. Nothing plays here. It says what ANTICON is, lets you try
 * its one idea (a switch is a word; off is the word with a line through it),
 * and lays out the ten films. Choose a film, press Enter, or scroll to the
 * end of the page, and the player rises over it.
 *
 * The page keeps the player's own grammar: words on the edges, and the films
 * begin where the page ends.
 */

const CONTRA = 'https://contra.com/boomtumbali';

function Toggle({ children, init = true }) {
  const [on, setOn] = useState(init);
  return (
    <button type="button" className="ln-word" aria-pressed={on} data-off={!on || undefined} onClick={() => setOn(!on)}>
      <span>{children}</span>
    </button>
  );
}

export function Landing({ hidden, onEnter }) {
  const root = useRef(null);
  const door = useRef(null);
  const enteredBy = useRef(null);

  const enter = (i, how = 'choice') => {
    enteredBy.current = how;
    onEnter(i);
  };

  // the end of the page is the start of the films
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio >= 0.92 && !hiddenRef.current) {
          enteredBy.current = 'door';
          onEnter(0);
        }
      },
      { threshold: [0.92] },
    );
    io.observe(door.current);
    return () => io.disconnect();
  }, [onEnter]);

  // once the player covers the page: if you came in through the end of the page, you come back to its top
  useEffect(() => {
    if (!hidden) return undefined;
    const id = setTimeout(() => {
      if (enteredBy.current === 'door') scrollTo({ top: 0, behavior: 'instant' });
    }, 1100);
    return () => clearTimeout(id);
  }, [hidden]);

  return (
    <div className="ln" ref={root} inert={hidden || undefined} aria-hidden={hidden || undefined}>
      <SiteHeader page="feed" className="ln-top" />

      <section className="ln-hero" data-name="Intro">
        <p className="ln-kicker ln-mono">
          A video player · Built on <VideoJsLink mark={false} />
        </p>
        <h1 className="ln-mark" aria-label="ANTICON">
          <span aria-hidden="true">ΛNT</span>
          <span className="ln-icon" aria-hidden="true">
            ICON
          </span>
        </h1>
        <p className="ln-lede">
          A player with no icons. Every control is a word, every number is a number, and a word with a line through it is off.
        </p>
        {/* one thing to do, then the way the page goes on, then something to play with */}
        <div className="ln-cta">
          <button type="button" className="ln-enter" onClick={() => enter(0)} onPointerEnter={() => warmFilm(FILMS[0])} onFocus={() => warmFilm(FILMS[0])} aria-label="Enter. The films play with sound">
            Enter
          </button>
          <span className="ln-mono ln-dim">or keep scrolling</span>
        </div>
        <div className="ln-try">
          <span className="ln-mono ln-dim">Try the words</span>
          <Toggle>Sound</Toggle>
          <Toggle init={false}>Loop</Toggle>
          <Toggle>Captions</Toggle>
          <Toggle init={false}>Fill</Toggle>
        </div>
        <span className="ln-edge ln-edge-l ln-mono" aria-hidden="true">
          Scroll to begin
        </span>
        <a className="ln-edge ln-edge-r ln-mono" href={CONTRA} target="_blank" rel="noreferrer" aria-label="Vibecoded by Boom Tumbali, on Contra">
          Boom Tumbali
        </a>
      </section>

      <section className="ln-ten" data-name="The ten" aria-labelledby="ln-ten-h">
        <header className="ln-head">
          <p className="ln-mono ln-dim" id="ln-ten-h">
            The ten
          </p>
          <p className="ln-h2">Ten open movies from Blender Studio, one to a screen. Pick one to begin there; after the tenth, the first comes round again.</p>
        </header>
        <ol className="ln-list">
          {FILMS.map((f, i) => (
            <li key={f.id}>
              <button type="button" className="ln-row" onClick={() => enter(i)} onPointerEnter={() => warmFilm(f)} onFocus={() => warmFilm(f)} aria-label={`Play ${f.title}, ${f.year}`}>
                <span className="ln-n ln-mono">{pad2(f.n)}</span>
                <span className="ln-t">
                  {f.title}
                  {f.subtitle && <span className="ln-sub ln-mono">{f.subtitle}</span>}
                </span>
                <span className="ln-pic" aria-hidden="true">
                  <img {...stillSet(f, LIST_SIZES)} alt="" decoding="async" />
                </span>
                <span className="ln-y ln-mono">{f.year}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section className="ln-how" data-name="How it plays" aria-labelledby="ln-how-h">
        <p className="ln-mono ln-dim" id="ln-how-h">
          How it plays
        </p>
        <ol className="ln-points">
          <li>
            <span className="ln-mono ln-dim">01</span>
            <h2>Words, not icons</h2>
            <p>Play, Sound, Fill, Full. Off is the same word with a hairline through it. Progress is one line with nothing riding on it.</p>
          </li>
          <li>
            <span className="ln-mono ln-dim">02</span>
            <h2>On the edges</h2>
            <p>Playback reads up the left edge, view and sound down the right, time along the bottom. On a short screen the edges keep their words, fewer and closer.</p>
          </li>
          <li>
            <span className="ln-mono ln-dim">03</span>
            <h2>Keys and touch</h2>
            <p>Space, arrows, numbers, M, F, Q, and ? for the rest. Drag sideways to scrub; slide up or down on the left for sound, on the right for the next film. Double-tap a side for ten seconds; pinch to fill.</p>
          </li>
          <li>
            <span className="ln-mono ln-dim">04</span>
            <h2>Ink that reads the picture</h2>
            <p>Over a white sky the words turn dark; over night they stay light. Each edge decides for itself.</p>
          </li>
        </ol>
        <footer className="ln-credits">
          <p>
            <span className="ln-mono ln-dim">Built on</span>
            <span className="ln-vjs">
              <VideoJsLink height={15} />
            </span>
          </p>
          <p>
            <span className="ln-mono ln-dim">Streams</span>
            <span className="ln-logo">
              <MuxLink height={14} />
            </span>
          </p>
          <p>
            <span className="ln-mono ln-dim">Films</span>
            <span>
              <BlenderLink />
            </span>
          </p>
          <p>
            <span className="ln-mono ln-dim">Vibecoder</span>
            <a className="ln-name" href={CONTRA} target="_blank" rel="noreferrer">
              @boomtumbali
            </a>
          </p>
        </footer>
      </section>

      <section className="ln-door" ref={door} data-name="Begin" aria-label="Begin">
        <button type="button" className="ln-begin" onClick={() => enter(0)}>
          Begin
        </button>
        <span className="ln-mono ln-dim">The films start here</span>
      </section>

    </div>
  );
}

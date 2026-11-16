import { StrictMode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../vercel.js';
import '@fontsource-variable/inter-tight';
import '@fontsource-variable/geist-mono';
import '../brand.css';
import '../anticon.css';
import './lab.css';
import { AnticonPlayer } from '../player/AnticonPlayer.jsx';
import { FILMS, LOCAL, localSrc, storyboardOf } from '../films.js';
import { VideoJsMark } from './VideoJsMark.jsx';
import { Wordmark } from '../Wordmark.jsx';
import { ThemeWord } from '../theme.jsx';

/*
 * The player lab. One ANTICON player, put through the screens it will meet
 * (phone either way, tablet, laptop, desktop, TV, or whatever the window is)
 * and the pictures that are hardest to read over (white, paper, black, bars,
 * half and half). The readout says what the skin decided: its box, how the
 * edges are set, and which ink each edge chose.
 */

const SCREENS = [
  { id: 'phone', name: 'Phone', w: 390, h: 844 },
  { id: 'phone-side', name: 'Phone, sideways', w: 844, h: 390 },
  { id: 'tablet', name: 'Tablet', w: 820, h: 1180 },
  { id: 'laptop', name: 'Laptop', w: 1280, h: 800 },
  { id: 'desktop', name: 'Desktop', w: 1440, h: 900 },
  { id: 'tv', name: 'Television', w: 1920, h: 1080 },
  { id: 'embed', name: 'Embed, 16 : 9', w: 640, h: 360 },
  { id: 'free', name: 'Free (the stage)', w: 0, h: 0 },
];
const CARDS = [
  { id: 'white', name: 'White', src: '/test/white.mp4' },
  { id: 'paper', name: 'Paper', src: '/test/paper.mp4' },
  { id: 'black', name: 'Black', src: '/test/black.mp4' },
  { id: 'bars', name: 'Bars', src: '/test/bars.mp4' },
  { id: 'split', name: 'Half and half', src: '/test/split.mp4' },
];
// each choice's id is the ink it gives
const INKS = [
  { id: 'adapt', name: 'Adapt to the picture' },
  { id: 'light', name: 'Always light ink' },
  { id: 'dark', name: 'Always dark ink' },
];

const read = (key, fallback) => {
  try {
    return localStorage.getItem(`anticon-lab-${key}`) ?? fallback;
  } catch {
    return fallback;
  }
};
const keep = (key, v) => {
  try {
    localStorage.setItem(`anticon-lab-${key}`, v);
  } catch {
    /* private window: fine */
  }
};

/** A choice among words: the chosen one carries a short rule before it. */
function Choice({ label, items, value, onChange }) {
  return (
    <div className="lab-group" role="radiogroup" aria-label={label}>
      <p className="lab-label">{label}</p>
      <ul>
        {items.map((it) => (
          <li key={it.id}>
            <button type="button" role="radio" aria-checked={value === it.id} className="lab-opt" onClick={() => onChange(it.id)}>
              <span>{it.name}</span>
              {it.note && <span className="lab-note">{it.note}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Lab() {
  const [screen, setScreen] = useState(() => read('screen', matchMedia('(max-width: 800px)').matches ? 'free' : 'phone-side'));
  const [pic, setPic] = useState(() => read('pic', 'sprite-fright'));
  const [ink, setInk] = useState(() => read('ink', 'adapt')); // (a new key: the old one stored the opposite names)
  useEffect(() => keep('screen', screen), [screen]);
  useEffect(() => keep('pic', pic), [pic]);
  useEffect(() => keep('ink', ink), [ink]);

  // the stage measures itself; a screen bigger than the stage is shown scaled down, at its true size inside
  const stage = useRef(null);
  const [room, setRoom] = useState({ w: 800, h: 500 });
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setRoom({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(stage.current);
    return () => ro.disconnect();
  }, []);
  const sc = SCREENS.find((s) => s.id === screen) ?? SCREENS[0];
  const w = sc.id === 'free' ? Math.floor(room.w) : sc.w;
  const h = sc.id === 'free' ? Math.floor(room.h) : sc.h;
  const k = Math.min(1, room.w / w, room.h / h);

  const film = FILMS.find((f) => f.id === pic);
  const card = CARDS.find((c) => c.id === pic);
  const media = card
    ? { src: card.src, title: card.name, meta: 'Test card' }
    : { ...(LOCAL ? { src: localSrc(film), storyboard: storyboardOf(film) } : { playbackId: film.playbackId }), title: film.title, meta: `${film.year} · ${film.studio}` };

  // what the skin decided, read back from it
  const [out, setOut] = useState(null);
  useEffect(() => {
    const id = setInterval(() => {
      const ac = stage.current?.querySelector('.ac');
      if (!ac) return;
      const left = ac.querySelector('.ac-left');
      const d = ac.dataset;
      setOut({
        box: `${ac.clientWidth} × ${ac.clientHeight}`,
        edges: left && getComputedStyle(left).writingMode.startsWith('vertical') ? 'Along both edges' : 'Along the bottom',
        hidden: [...ac.querySelectorAll('.ac-edges [data-pri]')].filter((e) => getComputedStyle(e).display === 'none').length,
        ink: [['tl', 'title'], ['tr', 'corner'], ['left', 'left'], ['right', 'right'], ['bottom', 'bottom']].map(([z, n]) => `${n} ${{ light: 'dark', mixed: 'light, haloed' }[d[`tone${z[0].toUpperCase()}${z.slice(1)}`]] ?? 'light'}`).join(' · '),
      });
    }, 300);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="lab">
      <header className="lab-head">
        <a className="lab-brand" href="/" aria-label="ANTICON, the start">
          <Wordmark />
        </a>
        <span className="lab-title">Player lab</span>
        <span className="lab-built">
          <span>Built on</span>
          <VideoJsMark height={13} ink="currentColor" />
          <span>10</span>
          <ThemeWord className="lab-theme" />
        </span>
      </header>

      <aside className="lab-side">
        <Choice label="Screen" value={screen} onChange={setScreen} items={SCREENS.map((s) => ({ ...s, note: s.w ? `${s.w} × ${s.h}` : null }))} />
        <Choice
          label="Picture"
          value={pic}
          onChange={setPic}
          items={[...CARDS.map((c) => ({ id: c.id, name: c.name, note: 'card' })), ...FILMS.map((f) => ({ id: f.id, name: f.title, note: String(f.year) }))]}
        />
        <Choice label="Ink" value={ink} onChange={setInk} items={INKS} />
        <nav className="lab-links" aria-label="Pages">
          <a href="/">The feed</a>
          <a href="/embed/">The player on a page</a>
        </nav>
        <p className="lab-credit">
          <span>Vibecoder</span>
          <a href="https://contra.com/boomtumbali" target="_blank" rel="noreferrer">
            @boomtumbali
          </a>
        </p>
      </aside>

      <main className="lab-stage" ref={stage}>
        <div className="lab-frame" style={{ width: w * k, height: h * k }}>
          <div style={{ width: w, height: h, transform: `scale(${k})`, transformOrigin: '0 0' }}>
            <AnticonPlayer key={`${pic}`} {...media} autoPlay ink={ink} aspect={null} style={{ width: w, height: h }} />
          </div>
        </div>
      </main>

      <footer className="lab-read" aria-live="polite">
        {out && (
          <>
            <span>
              <b>Box</b> {out.box}
              {k < 1 && <span className="lab-note"> shown at {Math.round(k * 100)}%</span>}
            </span>
            <span>
              <b>Words</b> {out.edges}
              {out.hidden > 0 && <span className="lab-note"> · {out.hidden} resting</span>}
            </span>
            <span>
              <b>Ink</b> {out.ink}
            </span>
          </>
        )}
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Lab />
  </StrictMode>,
);

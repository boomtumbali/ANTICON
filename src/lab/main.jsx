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
import { VideoJsLink } from '../credits.jsx';
import { Wordmark } from '../Wordmark.jsx';
import { ThemeWord } from '../theme.jsx';

/*
 * The player lab. One ANTICON player, put through the screens it will meet
 * (phone either way, tablet, laptop, desktop, TV, an embed, or the stage
 * itself) and the pictures that are hardest to read over (white, paper,
 * black, bars, half and half), and the ten films.
 *
 * Wide screens choose from two lists beside the stage. Phones and portrait
 * screens put the player first, full width, and choose from two rows of words
 * that slide sideways under the thumb.
 */

const SCREENS = [
  { id: 'phone', name: 'Phone', w: 390, h: 844 },
  { id: 'phone-side', name: 'Phone sideways', w: 844, h: 390 },
  { id: 'tablet', name: 'Tablet', w: 820, h: 1180 },
  { id: 'laptop', name: 'Laptop', w: 1280, h: 800 },
  { id: 'desktop', name: 'Desktop', w: 1440, h: 900 },
  { id: 'tv', name: 'Television', w: 1920, h: 1080 },
  { id: 'embed', name: 'Embed 16:9', w: 640, h: 360 },
  { id: 'free', name: 'The stage', w: 0, h: 0 },
];
const CARDS = [
  { id: 'white', name: 'White', src: '/test/white.mp4' },
  { id: 'paper', name: 'Paper', src: '/test/paper.mp4' },
  { id: 'black', name: 'Black', src: '/test/black.mp4' },
  { id: 'bars', name: 'Bars', src: '/test/bars.mp4' },
  { id: 'split', name: 'Half and half', src: '/test/split.mp4' },
];
const NARROW = '(max-width: 899px), (orientation: portrait) and (max-width: 1100px)';

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
function useMatch(q) {
  const [m, setM] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

/** A choice among words: the chosen one carries a dash before it. A list beside the stage, or a row that slides. */
function Choice({ label, items, value, onChange, row }) {
  const list = useRef(null);
  // in a row, keep the chosen word in view
  useEffect(() => {
    if (!row) return;
    const el = list.current?.querySelector('[aria-checked="true"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [row, value]);
  return (
    <div className={row ? 'lab-group lab-group--row' : 'lab-group'} role="radiogroup" aria-label={label}>
      <p className="lab-label">{label}</p>
      <ul ref={list}>
        {items.map((it) => (
          <li key={it.id}>
            <button type="button" role="radio" aria-checked={value === it.id} className="lab-opt" onClick={() => onChange(it.id)}>
              <span className="lab-dash" aria-hidden="true">–</span>
              <span className="lab-name">{it.name}</span>
              {!row && it.note && <span className="lab-note">{it.note}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Lab() {
  const narrow = useMatch(NARROW);
  const [screen, setScreen] = useState(() => read('screen', matchMedia(NARROW).matches ? 'free' : 'phone-side'));
  const [pic, setPic] = useState(() => read('pic', 'sprite-fright'));
  useEffect(() => keep('screen', screen), [screen]);
  useEffect(() => keep('pic', pic), [pic]);

  // the stage measures itself; a screen bigger than the stage is shown scaled down, at its true size inside.
  // On a narrow screen the stage is the page's width, and as tall as the screen allows with the choices in reach.
  const stage = useRef(null);
  const [room, setRoom] = useState({ w: 800, h: 500 });
  const [vh, setVh] = useState(() => innerHeight);
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setRoom({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(stage.current);
    const on = () => setVh(innerHeight);
    addEventListener('resize', on);
    return () => {
      ro.disconnect();
      removeEventListener('resize', on);
    };
  }, []);
  const roomH = narrow ? Math.max(240, Math.round(vh * 0.6)) : room.h;
  const sc = SCREENS.find((s) => s.id === screen) ?? SCREENS[0];
  const w = sc.id === 'free' ? Math.floor(room.w) : sc.w;
  const h = sc.id === 'free' ? Math.floor(narrow ? Math.min(roomH, (room.w * 9) / 16) : room.h) : sc.h;
  const k = Math.min(1, room.w / w, roomH / h);

  const film = FILMS.find((f) => f.id === pic);
  const card = CARDS.find((c) => c.id === pic);
  const media = card
    ? { src: card.src, title: card.name, meta: 'Test card' }
    : { ...(LOCAL ? { src: localSrc(film), storyboard: storyboardOf(film) } : { playbackId: film.playbackId }), title: film.title, meta: `${film.year} · ${film.studio}` };

  const screens = SCREENS.map((s) => ({ ...s, note: s.w ? `${s.w} × ${s.h}` : null }));
  const pictures = [...CARDS.map((c) => ({ id: c.id, name: c.name, note: 'card' })), ...FILMS.map((f) => ({ id: f.id, name: f.title, note: String(f.year) }))];

  return (
    <div className="lab" data-narrow={narrow || undefined}>
      <header className="lab-head">
        <a className="lab-brand" href="/" aria-label="ANTICON, the start">
          <Wordmark />
        </a>
        <span className="lab-title">Player lab</span>
        <nav className="lab-nav" aria-label="Pages">
          <span className="lab-built">
            <span>Built on</span>
            <VideoJsLink height={13} />
          </span>
          <a className="lab-navlink" href="/">
            The feed
          </a>
          <a className="lab-navlink" href="/embed/">
            Embed
          </a>
          <a className="lab-navlink" href="https://github.com/boomtumbali/anticon" target="_blank" rel="noreferrer">
            Source
          </a>
          <ThemeWord />
        </nav>
      </header>

      <main className="lab-stage" ref={stage} style={narrow ? { height: Math.round(h * k) } : undefined}>
        <div className="lab-frame" style={{ width: w * k, height: h * k }}>
          <div style={{ width: w, height: h, transform: `scale(${k})`, transformOrigin: '0 0' }}>
            <AnticonPlayer key={`${pic}`} {...media} autoPlay aspect={null} style={{ width: w, height: h }} />
          </div>
        </div>
      </main>

      <aside className="lab-side">
        <Choice label="Screen" value={screen} onChange={setScreen} items={screens} row={narrow} />
        <Choice label="Picture" value={pic} onChange={setPic} items={pictures} row={narrow} />
        <nav className="lab-links" aria-label="More">
          <a className="lab-sidelink" href="/">
            The feed
          </a>
          <a className="lab-sidelink" href="/embed/">
            The player on a page
          </a>
          <a className="lab-sidelink" href="https://github.com/boomtumbali/anticon" target="_blank" rel="noreferrer">
            Source
          </a>
          <a href="https://contra.com/boomtumbali" target="_blank" rel="noreferrer">
            @boomtumbali
          </a>
        </nav>
      </aside>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Lab />
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../vercel.js';
import '@fontsource-variable/inter-tight';
import '@fontsource-variable/geist-mono';
import '../brand.css';
import '../anticon.css';
import './embed.css';
import { AnticonPlayer } from '../player/AnticonPlayer.jsx';
import { FILMS, LOCAL, localSrc, storyboardOf } from '../films.js';
import { Wordmark } from '../Wordmark.jsx';
import { BlenderLink, MuxLink, VideoJsLink } from '../credits.jsx';
import { ThemeWord } from '../theme.jsx';

/*
 * The player on its own, in an ordinary page, at the sizes a site would
 * really give it: a full column, a narrow sidebar, an upright phone-shaped
 * box, a cinema-wide strip and a thumbnail. One film each, no feed.
 */
const pick = (id) => FILMS.find((f) => f.id === id);
const props = (f) => ({
  title: f.title,
  meta: `${f.year} · ${f.studio}`,
  ...(LOCAL ? { src: localSrc(f), storyboard: storyboardOf(f) } : { playbackId: f.playbackId }),
});

const CODE = `import { AnticonPlayer } from './player/AnticonPlayer.jsx';

<AnticonPlayer
  playbackId="n023uDxWiI5UtuxgFWAmRw00gWsM8Fvou00EGc1i0100DDhg"
  title="Sprite Fright"
  meta="2021 · Blender Studio"
  aspect="16 / 9"
/>`;

function Page() {
  return (
    <main className="ep">
      <header className="ep-head">
        <a className="ep-mark" href="/" aria-label="ANTICON, the start">
          <Wordmark />
        </a>
        <span className="ep-built">
          Built on <VideoJsLink height={12} />
        </span>
        <nav className="ep-nav">
          <a className="ep-link" href="/">The feed</a>
          <a className="ep-link" href="/player/">Player lab</a>
          <ThemeWord />
        </nav>
      </header>
      <section className="ep-intro">
        <p className="ep-kicker">The player on its own</p>
        <h1>One film, any box.</h1>
        <p>
          ANTICON is a <VideoJsLink mark={false} /> player with no icons. Here it sits in an ordinary page, one film per player, at the sizes a
          site would really give it. Every word is placed from the player's own box: the words always stand up both edges, and the shorter the box, the
          fewer and closer they are, down to Play, Sound and Full.
        </p>
      </section>

      <figure className="ep-fig">
        <AnticonPlayer {...props(pick('sprite-fright'))} aspect="16 / 9" />
        <figcaption>16 : 9, a full column</figcaption>
      </figure>

      <div className="ep-row">
        <figure className="ep-fig ep-portrait">
          <AnticonPlayer {...props(pick('agent-327'))} aspect="9 / 16" />
          <figcaption>9 : 16, phone-shaped</figcaption>
        </figure>
        <div className="ep-col">
          <figure className="ep-fig">
            <AnticonPlayer {...props(pick('charge'))} aspect="21 / 9" />
            <figcaption>21 : 9, a cinema strip</figcaption>
          </figure>
          <div className="ep-pair">
            <figure className="ep-fig">
              <AnticonPlayer {...props(pick('singularity'))} aspect="4 / 3" />
              <figcaption>4 : 3, a sidebar</figcaption>
            </figure>
            <figure className="ep-fig ep-thumb">
              <AnticonPlayer {...props(pick('spring'))} aspect="16 / 9" />
              <figcaption>a thumbnail</figcaption>
            </figure>
          </div>
        </div>
      </div>

      <section className="ep-code">
        <h2>Use it</h2>
        <pre>
          <code>{CODE}</code>
        </pre>
        <p>Give it a width and an aspect ratio. A Mux playback ID, or any MP4 or HLS link as <code>src</code>.</p>
      </section>
      <footer className="ep-foot">
        <span className="ep-credit">
          <span>Built on</span>
          <VideoJsLink height={11} />
        </span>
        <span className="ep-credit">
          <span>Streams</span>
          <MuxLink height={10} />
        </span>
        <span className="ep-credit">
          <span>Films</span>
          <span>
            <BlenderLink />, Creative Commons
          </span>
        </span>
        <span className="ep-credit">
          <span>Vibecoder</span>
          <a href="https://contra.com/boomtumbali" target="_blank" rel="noreferrer">
            @boomtumbali
          </a>
        </span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);

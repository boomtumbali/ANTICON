import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../vercel.js';
import '@fontsource-variable/inter-tight';
import '@fontsource-variable/geist-mono';
import '../anticon.css';
import './embed.css';
import { AnticonPlayer } from '../player/AnticonPlayer.jsx';
import { FILMS, LOCAL, localSrc, storyboardOf } from '../films.js';
import { VideoJsMark } from '../lab/VideoJsMark.jsx';

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
        <a className="ep-mark" href="/">ANTICON</a>
        <span className="ep-built">
          Built on <VideoJsMark height={12} ink="#141414" /> 10
        </span>
        <nav className="ep-nav">
          <a className="ep-link" href="/">The feed</a>
          <a className="ep-link" href="/player/">Player lab</a>
        </nav>
      </header>
      <section className="ep-intro">
        <p className="ep-kicker">The player on its own</p>
        <h1>One film, any box.</h1>
        <p>
          ANTICON is a Video.js 10 player with no icons. Here it sits in an ordinary page, one film per player, at the sizes a
          site would really give it. Every word is placed from the player's own box: tall boxes keep words along both edges, shorter ones lay them
          along the bottom, small ones keep only what you need.
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
        <span>Player</span>
        <a href="https://contra.com/boomtumbali" target="_blank" rel="noreferrer">
          Boom Tumbali
        </a>
        <span className="ep-foot-note">Films by Blender Studio, Creative Commons · Hosted on Mux</span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);

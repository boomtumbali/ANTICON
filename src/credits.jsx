/*
 * The projects ANTICON stands on, each a link to its own site, in one order everywhere:
 * Video.js, Mux, Blender Studio (then the vibecoder). Marks are drawn in the page's ink.
 */
import { VideoJsMark } from './lab/VideoJsMark.jsx';
import { MuxMark } from './marks/Marks.jsx';

export const VIDEOJS_URL = 'https://videojs.com';
export const MUX_URL = 'https://www.mux.com';
export const BLENDER_URL = 'https://studio.blender.org';

const ext = { target: '_blank', rel: 'noreferrer' };

export function VideoJsLink({ height = 13, mark = true }) {
  return (
    <a className="mk-link" href={VIDEOJS_URL} {...ext} aria-label={mark ? 'Video.js' : undefined}>
      {mark ? <VideoJsMark height={height} ink="currentColor" /> : 'Video.js'}
    </a>
  );
}
export function MuxLink({ height = 12, mark = true }) {
  return (
    <a className="mk-link" href={MUX_URL} {...ext} aria-label={mark ? 'Mux' : undefined}>
      {mark ? <MuxMark height={height} /> : 'Mux'}
    </a>
  );
}
export function BlenderLink({ children = 'Blender Studio' }) {
  return (
    <a className="mk-link" href={BLENDER_URL} {...ext}>
      {children}
    </a>
  );
}

/** The credits at the foot of a page, in one order: Video.js, Mux, Blender Studio, the vibecoder. */
export function SiteCredits() {
  return (
    <footer className="site-foot">
      <span className="site-credit">
        <span>Built on</span>
        <VideoJsLink height={11} />
      </span>
      <span className="site-credit">
        <span>Streams</span>
        <MuxLink height={10} />
      </span>
      <span className="site-credit">
        <span>Films</span>
        <BlenderLink />
      </span>
      <span className="site-credit">
        <span>Vibecoder</span>
        <a className="site-name" href="https://contra.com/boomtumbali" target="_blank" rel="noreferrer">
          @boomtumbali
        </a>
      </span>
    </footer>
  );
}

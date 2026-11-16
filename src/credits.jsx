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

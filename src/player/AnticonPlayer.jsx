import { useEffect, useMemo, useRef, useState } from 'react';
import { Video } from '@videojs/react/video';
import { MuxVideo } from '@videojs/react/media/mux-video';
import { Player } from './core.js';
import { AnticonSkin } from './Skin.jsx';

/**
 * One film, one player, any box. Give it a Mux playback ID (or any MP4/HLS
 * `src`), a title, and a size: a width and an aspect ratio is enough. The
 * skin lays itself out from that box, so it reads the same in a narrow
 * column, a full-width hero, an upright phone or a TV.
 *
 *   <AnticonPlayer playbackId="…" title="Sprite Fright" meta="2021 · Blender Studio" />
 */
export function AnticonPlayer({ title, meta, playbackId, src, poster, storyboard, autoPlay = false, aspect = '16 / 9', defaultFill = false, corner, tone, className = '', style }) {
  return (
    <Player>
      <Single {...{ title, meta, playbackId, src, poster, storyboard, autoPlay, aspect, defaultFill, corner, tone, className, style }} />
    </Player>
  );
}

function Single({ title, meta, playbackId, src, poster, storyboard, autoPlay, aspect, defaultFill, corner, tone, className, style }) {
  const media = useRef(null);
  const [loop, setLoop] = useState(false);
  useEffect(() => {
    if (media.current) media.current.loop = loop;
  }, [loop]);
  const source = useMemo(() => (playbackId ? { playbackId, preferPlayback: 'mse', poster: { width: 1600 } } : null), [playbackId]);
  const still = poster ?? (playbackId ? `https://image.mux.com/${playbackId}/thumbnail.webp?width=1600` : null);
  return (
    <AnticonSkin
      title={title}
      meta={meta}
      loop={loop}
      onLoop={setLoop}
      corner={corner}
      defaultFill={defaultFill}
      tone={tone}
      storyboard={storyboard ?? (playbackId ? `https://image.mux.com/${playbackId}/storyboard.json?format=webp` : undefined)}
      className={`ac--box ${className}`.trim()}
      style={aspect ? { aspectRatio: aspect, ...style } : style}
    >
      {still && <img className="ac-still" src={still} alt="" aria-hidden="true" decoding="async" />}
      {src ? (
        <Video ref={media} className="ac-media" src={src} playsInline preload="metadata" autoPlay={autoPlay} muted={autoPlay} />
      ) : (
        <MuxVideo ref={media} className="ac-media" source={source} crossOrigin="anonymous" playsInline preload="metadata" autoPlay={autoPlay} muted={autoPlay} />
      )}
    </AnticonSkin>
  );
}

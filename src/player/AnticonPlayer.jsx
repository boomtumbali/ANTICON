import { useEffect, useMemo, useRef, useState } from 'react';
import { Video } from '@videojs/react/video';
import { MuxVideo } from '@videojs/react/media/mux-video';
import { HlsJsVideo } from '@videojs/react/media/hlsjs-video';
import { Player } from './core.js';
import { AnticonSkin } from './Skin.jsx';

// one voice on a page: when a player starts, any other that is playing stops
const playing = new Set();

/**
 * One film, one player, any box. Give it a Mux playback ID (or any MP4/HLS
 * `src`), a title, and a size: a width and an aspect ratio is enough. The
 * skin lays itself out from that box, so it reads the same in a narrow
 * column, a full-width hero, an upright phone or a TV.
 *
 *   <AnticonPlayer playbackId="…" title="Sprite Fright" meta="2021 · Blender Studio" />
 *
 * `start` sets where the film waits: 'middle', or a time in seconds. With `autoPlay`,
 * the film tries to start with sound; where the browser refuses sound before a first
 * tap, click or key, it plays silent and says so, and that first touch turns sound on.
 */
export function AnticonPlayer({ title, meta, playbackId, src, poster, storyboard, autoPlay = false, start, aspect = '16 / 9', defaultFill = false, corner, className = '', style }) {
  return (
    <Player>
      <Single {...{ title, meta, playbackId, src, poster, storyboard, autoPlay, start, aspect, defaultFill, corner, className, style }} />
    </Player>
  );
}

const finePointer = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: fine)').matches;

function Single({ title, meta, playbackId, src, poster, storyboard, autoPlay, start, aspect, defaultFill, corner, className, style }) {
  const media = useRef(null);
  const [loop, setLoop] = useState(false);
  const [gate, setGate] = useState(false); // the browser started the film silent
  useEffect(() => {
    if (media.current) media.current.loop = loop;
  }, [loop]);
  useEffect(() => {
    const v = media.current;
    if (!v) return undefined;
    // where the film waits: placed once, as soon as its length is known
    let placed = start == null;
    const place = () => {
      if (placed || !(v.duration > 0) || !Number.isFinite(v.duration)) return;
      placed = true;
      const t = start === 'middle' ? v.duration / 2 : Number(start);
      if (t > 0 && t < v.duration - 1) v.currentTime = t;
    };
    const onPlay = () => {
      for (const o of playing) if (o !== v && !o.paused) o.pause();
      playing.add(v);
    };
    const onVol = () => !v.muted && setGate(false);
    v.addEventListener('loadedmetadata', place);
    v.addEventListener('durationchange', place);
    v.addEventListener('play', onPlay);
    v.addEventListener('volumechange', onVol);
    place();
    // sound first; if the browser refuses it, play silent and say so
    let started = false;
    const onStarted = () => (started = true);
    const go = () => {
      const p = v.play?.();
      p?.catch?.((err) => {
        if (err?.name !== 'NotAllowedError' || v.muted) return;
        v.muted = true;
        setGate(true);
        v.play?.()?.catch?.(() => {});
      });
    };
    // a stream can attach after the first play(): ask again once it can play, until it has started
    const onCan = () => !started && v.paused && go();
    if (autoPlay) {
      v.addEventListener('playing', onStarted);
      v.addEventListener('canplay', onCan);
      v.muted = false;
      go();
    }
    return () => {
      playing.delete(v);
      v.removeEventListener('loadedmetadata', place);
      v.removeEventListener('durationchange', place);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('volumechange', onVol);
      v.removeEventListener('playing', onStarted);
      v.removeEventListener('canplay', onCan);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // called inside a tap, click or key, so the browser lets the film speak
  const openSound = () => {
    const v = media.current;
    setGate(false);
    if (!v) return;
    v.muted = false;
    if (v.volume === 0) v.volume = 1;
    if (v.paused) v.play?.()?.catch?.(() => {});
  };
  const source = useMemo(() => (playbackId ? { playbackId, preferPlayback: 'mse', poster: { width: 1600 } } : null), [playbackId]);
  const still = poster ?? (playbackId ? `https://image.mux.com/${playbackId}/thumbnail.webp?width=1600` : null);
  const pre = autoPlay || start != null ? 'auto' : 'metadata';
  return (
    <AnticonSkin
      title={title}
      meta={meta}
      loop={loop}
      onLoop={setLoop}
      corner={corner}
      defaultFill={defaultFill}
      soundGate={gate}
      onSoundGate={openSound}
      below={gate ? <span className="ac-mono ac-gate">{finePointer() ? 'Sound is off · click or press any key' : 'Sound is off · tap anywhere'}</span> : null}
      storyboard={storyboard ?? (playbackId ? `https://image.mux.com/${playbackId}/storyboard.json?format=webp` : undefined)}
      className={`ac--box ${className}`.trim()}
      style={aspect ? { aspectRatio: aspect, ...style } : style}
    >
      {still && <img className="ac-still" src={still} alt="" aria-hidden="true" decoding="async" />}
      {src && /\.m3u8($|\?)/.test(src) ? (
        <HlsJsVideo ref={media} className="ac-media" src={src} crossOrigin="anonymous" playsInline preload={pre} />
      ) : src ? (
        <Video ref={media} className="ac-media" src={src} playsInline preload={pre} />
      ) : (
        <MuxVideo ref={media} className="ac-media" source={source} crossOrigin="anonymous" playsInline preload={pre} />
      )}
    </AnticonSkin>
  );
}

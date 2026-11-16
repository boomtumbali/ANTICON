import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Container, Gesture, Hotkey, StatusAnnouncer } from '@videojs/react';
import { subscribeToInputActions } from '@videojs/core/dom';
import { usePlayer } from './core.js';

/*
 * ANTICON's skin: a player with no icons. Words and numbers, set like a
 * poster on the edges of the player's own box.
 *
 *   top left      the title, and a line about it
 *   top right     a slot (the time of day, or whatever the page puts there)
 *   left edge     what the film does: play, back, forward, speed, captions, loop (read upward)
 *   right edge    how you see and hear it: sound, fill, picture in picture, cast, full (read downward)
 *   bottom        the time, one hairline of progress, the length
 *
 * A switch is a word: plain when on, a line through it when off.
 * Everything is sized by the player's box (container queries), never the
 * screen, so the same skin works as a page-filling feed, an embed in a
 * column, a phone held either way, or a TV.
 */

const pad2 = (n) => String(n).padStart(2, '0');
export function clock(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}
const hms = (sec) => {
  const v = Math.max(0, Math.floor(sec || 0));
  return `${pad2(Math.floor(v / 3600))}:${pad2(Math.floor(v / 60) % 60)}:${pad2(v % 60)}`;
};
const RATES = [1, 1.25, 1.5, 2, 0.5, 0.75];

const useMatch = (q) => {
  const [m, setM] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
};

/*
 * Tone: every word stays readable over any picture. A few times a second the
 * frame in view is drawn into a small canvas (96 px wide, the same fit as on
 * screen) and the brightness behind each edge is measured. Where the picture
 * is bright, that edge switches to dark ink on a light veil; where it is dark,
 * light ink on a dark veil. With a little hysteresis so it never flickers.
 * If the browser will not let a frame be read (a stream without CORS), the
 * edges keep light ink and the dark veils, which hold up on most films.
 */
// where each zone's words actually are, measured from the skin itself (so it follows every layout)
const ZONE_SEL = { tl: '.ac-tl', tc: '.ac-tc', tr: '.ac-tr', bottom: '.ac-bottom', left: '.ac-left', right: '.ac-right' };
function zonesOf(host) {
  const R = host.getBoundingClientRect();
  const out = { center: [0.3, 0.36, 0.7, 0.64] };
  for (const [name, sel] of Object.entries(ZONE_SEL)) {
    let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
    host.querySelectorAll(sel).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      x0 = Math.min(x0, (r.left - R.left) / R.width);
      y0 = Math.min(y0, (r.top - R.top) / R.height);
      x1 = Math.max(x1, (r.right - R.left) / R.width);
      y1 = Math.max(y1, (r.bottom - R.top) / R.height);
    });
    if (x1 > x0 && y1 > y0) out[name] = [Math.max(0, x0), Math.max(0, y0), Math.min(1, x1), Math.min(1, y1)];
  }
  return out;
}
function useTone(root, mode, fill) {
  const [tone, setTone] = useState({});
  useEffect(() => {
    if (mode !== 'adapt') {
      setTone({});
      return undefined;
    }
    const host = root.current;
    if (!host) return undefined;
    const W = 96; // about 13 px per sample on a laptop: fine enough to tell a letterbox band from the picture
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    let dead = false;
    let last = {};
    const read = () => {
      if (dead || document.hidden) return;
      const v = host.querySelector('video');
      if (!v || v.readyState < 2 || !v.videoWidth) return;
      const bw = host.clientWidth;
      const bh = host.clientHeight;
      if (!bw || !bh) return;
      const H = Math.max(8, Math.round((W * bh) / bw));
      cv.width = W;
      cv.height = H;
      // the same fit as on screen; the bands around a fitted film are dark (black, or the darkened blur in the feed)
      const s = (fill ? Math.max : Math.min)(W / v.videoWidth, H / v.videoHeight);
      const dw = v.videoWidth * s;
      const dh = v.videoHeight * s;
      const py0 = Math.max(0, (H - dh) / 2 / H); // where the picture starts and ends, as fractions of the box
      const py1 = Math.min(1, 1 - (H - dh) / 2 / H);
      // the veils start where the picture starts, so a letterbox band never turns grey
      const pt = `${Math.round(py0 * bh)}px`;
      const pb = `${Math.round((1 - py1) * bh)}px`;
      if (host.style.getPropertyValue('--pic-t') !== pt) host.style.setProperty('--pic-t', pt);
      if (host.style.getPropertyValue('--pic-b') !== pb) host.style.setProperty('--pic-b', pb);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      try {
        ctx.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh);
        const px = ctx.getImageData(0, 0, W, H).data;
        // mean luminance, and the share of bright pixels: a zone can sit half on a black band, half on a white sky
        const lumOf = ([x0, y0, x1, y1]) => {
          let sum = 0;
          let n = 0;
          let hi = 0;
          for (let y = Math.floor(y0 * H); y < Math.max(Math.floor(y0 * H) + 1, Math.ceil(y1 * H)); y++) {
            for (let x = Math.floor(x0 * W); x < Math.max(Math.floor(x0 * W) + 1, Math.ceil(x1 * W)); x++) {
              const i = (Math.min(H - 1, y) * W + Math.min(W - 1, x)) * 4;
              const l = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
              sum += l;
              if (l > 0.6) hi++;
              n++;
            }
          }
          return n ? [sum / n, hi / n] : [0, 0];
        };
        const zones = zonesOf(host);
        // and the picture under each veil
        zones.veilTop = [0, py0, 1, Math.min(py1, py0 + 0.2)];
        zones.veilBottom = [0, Math.max(py0, py1 - 0.24), 1, py1];
        const next = {};
        for (const [name, rect] of Object.entries(zones)) {
          const was = last[name] === 'light';
          const [lum, share] = lumOf(rect);
          const tone = lum > (was ? 0.5 : 0.62) ? 'light' : 'dark';
          // neither ink reads over both halves of a split zone: light ink, held by a firm dark halo
          next[name] = name !== 'center' && !name.startsWith('veil') && share > 0.18 && share < 0.82 ? 'mixed' : tone;
        }
        if (Object.keys(next).some((k) => next[k] !== last[k])) {
          last = next;
          setTone(next);
        }
      } catch {
        dead = true; // the frame cannot be read here: keep light ink and the veils
      }
    };
    const id = setInterval(read, 350);
    read();
    return () => clearInterval(id);
  }, [root, mode, fill]);
  if (mode === 'light') return { tl: 'light', tc: 'light', tr: 'light', bottom: 'light', left: 'light', right: 'light', center: 'light', veilTop: 'light', veilBottom: 'light' };
  return tone;
}

/** The local time, to the second, like a slate. */
export function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const zone = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? '';
    } catch {
      return '';
    }
  }, []);
  return (
    <span className="ac-mono" aria-hidden="true">
      {pad2(now.getHours())}:{pad2(now.getMinutes())}:{pad2(now.getSeconds())} {zone}
    </span>
  );
}

/** A switch that is a word: plain when on, a line through it when off (along the word, whichever way it reads). */
export function Word({ on, onClick, children, label, pri, hidden }) {
  if (hidden) return null;
  return (
    <button type="button" className="ac-word" aria-pressed={on} data-off={!on || undefined} data-pri={pri} onClick={onClick} aria-label={label}>
      <span>{children}</span>
    </button>
  );
}

/** A plain action, as a word. */
function Act({ onClick, children, label, pri, wide }) {
  return (
    <button type="button" className="ac-word ac-act" data-pri={pri} data-wide={wide || undefined} onClick={onClick} aria-label={label}>
      <span>{children}</span>
    </button>
  );
}

/** The volume as a number from 00 to 100: drag it (along its own axis), wheel it, or arrow it. */
function VolumeNumber({ value }) {
  const store = usePlayer();
  const drag = useRef(null);
  const set = (v) => {
    const c = Math.min(1, Math.max(0, v));
    store.setVolume(c);
    if (c > 0 && store.state.muted) store.setMuted(false);
  };
  const n = Math.round(value * 100);
  return (
    <span
      className="ac-vol"
      role="slider"
      tabIndex={0}
      aria-label="Volume"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={n}
      aria-valuetext={`${n} percent`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, v: value };
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const d = drag.current;
        set(d.v + ((e.clientX - d.x) + (d.y - e.clientY)) / 160);
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onWheel={(e) => {
        e.stopPropagation();
        set(value - Math.sign(e.deltaY) * 0.05);
      }}
      onKeyDown={(e) => {
        const dv = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05 }[e.key];
        if (dv != null) {
          e.preventDefault();
          e.stopPropagation();
          set(value + dv);
        }
      }}
    >
      {n === 100 ? '100' : pad2(n)}
    </span>
  );
}

/** One hairline of progress. No knob, no dot. Point at it and the time appears large in the middle. */
function Scrub({ onPeek }) {
  const store = usePlayer();
  const t = usePlayer((s) => s.currentTime);
  const d = usePlayer((s) => s.duration);
  const buffered = usePlayer((s) => s.buffered);
  const ref = useRef(null);
  const [hover, setHover] = useState(null);
  const [drag, setDrag] = useState(null);
  const at = (x) => {
    const r = ref.current.getBoundingClientRect();
    return Math.min(1, Math.max(0, (x - r.left) / r.width));
  };
  const seek = (f) => d && store.seek(f * d);
  const f = drag != null ? drag : d ? t / d : 0;
  const bufEnd = buffered?.length ? Math.max(...buffered.map((b) => b[1])) : 0;
  const point = drag ?? hover;
  useEffect(() => onPeek(point != null && d > 0 ? point * d : null), [point, d, onPeek]);
  return (
    <div
      ref={ref}
      className="ac-scrub"
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(d || 0)}
      aria-valuenow={Math.round(t || 0)}
      aria-valuetext={`${clock(t)} of ${clock(d)}`}
      data-active={point != null || undefined}
      style={{ '--f': f, '--b': d ? Math.min(1, bufEnd / d) : 0 }}
      onPointerEnter={(e) => e.pointerType !== 'touch' && setHover(at(e.clientX))}
      onPointerMove={(e) => {
        const p = at(e.clientX);
        if (e.pointerType !== 'touch') setHover(p);
        if (drag != null) {
          setDrag(p);
          seek(p);
        }
      }}
      onPointerLeave={() => setHover(null)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = at(e.clientX);
        setDrag(p);
        seek(p);
      }}
      onPointerUp={(e) => {
        setDrag(null);
        if (e.pointerType === 'touch') setHover(null);
      }}
      onPointerCancel={() => setDrag(null)}
      onKeyDown={(e) => {
        const s = { ArrowRight: 5, ArrowLeft: -5, PageUp: 60, PageDown: -60 }[e.key];
        if (s != null && d) {
          e.preventDefault();
          e.stopPropagation();
          store.seek(Math.min(d, Math.max(0, t + s)));
        } else if ((e.key === 'Home' || e.key === 'End') && d) {
          e.preventDefault();
          e.stopPropagation();
          store.seek(e.key === 'Home' ? 0 : d - 1);
        }
      }}
    >
      <span className="ac-line" aria-hidden="true">
        <span className="ac-line-b" />
        <span className="ac-line-f" />
      </span>
    </div>
  );
}

/** The pointer as words: Play or Pause over the running timecode. Mouse and pen only. */
function Cursor({ root }) {
  const paused = usePlayer((s) => s.paused);
  const ended = usePlayer((s) => s.ended);
  const t = usePlayer((s) => s.currentTime);
  const ref = useRef(null);
  const [over, setOver] = useState(false);
  useEffect(() => {
    const host = root.current;
    const el = ref.current;
    if (!host || !el) return undefined;
    let raf = 0;
    const move = (e) => {
      if (e.pointerType === 'touch') return;
      const r = host.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => (el.style.transform = `translate3d(${x}px, ${y}px, 0)`));
      // only over the picture itself: over a word, the ordinary pointer
      const free = !e.target.closest?.('button, [role=slider], a, [role=dialog], .ac-nofilm');
      setOver(free);
    };
    const leave = () => setOver(false);
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerdown', move);
    host.addEventListener('pointerleave', leave);
    return () => {
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerdown', move);
      host.removeEventListener('pointerleave', leave);
      cancelAnimationFrame(raf);
    };
  }, [root]);
  return (
    <div ref={ref} className="ac-cursor" data-shown={over || undefined} aria-hidden="true">
      <span>{ended ? 'Replay' : paused ? 'Play' : 'Pause'}</span>
      <span>{hms(t)}</span>
    </div>
  );
}

/** Every key and every touch, as a list. Opens with ? or the word in the corner; Esc closes. */
function KeysSheet({ feed, fine, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.querySelector('button')?.focus({ preventScroll: true });
  }, []);
  const keys = [
    ['Space  K', 'Play or pause'],
    ['←  →   J  L', '10 seconds back or forward'],
    ['Shift ←  →', '30 seconds'],
    [',  .', 'One frame (pauses)'],
    ['Home  End', 'The start, the end'],
    ['0 – 9', 'Jump to 0 % … 90 %'],
    feed ? ['↑  ↓   N  P', 'Previous or next film'] : ['↑  ↓', 'Volume'],
    feed ? ['Shift ↑  ↓', 'Volume'] : null,
    ['M', 'Sound on or off'],
    ['C', 'Captions'],
    ['<  >', 'Slower, faster'],
    ['F   double-click', 'Full screen'],
    ['I', 'Picture in picture'],
    ['?   Esc', 'This list, close'],
  ].filter(Boolean);
  const touch = [
    ['Tap', 'Play or pause'],
    ['Double-tap a side', '10 seconds back or forward'],
    ['Keep tapping', '10 more each time'],
    ['Double-tap the middle', 'Fill or fit'],
    ['Hold', 'Twice the speed, while you hold'],
    ['Slide sideways', 'Scrub, up to three minutes across'],
    ['Pinch', 'Out to fill, in to fit'],
    feed ? ['Swipe up or down', 'Next or previous film'] : null,
  ].filter(Boolean);
  const List = ({ title, rows }) => (
    <section>
      <h3 className="ac-mono ac-dim">{title}</h3>
      <dl>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
  return (
    <div className="ac-keys" role="dialog" aria-modal="true" aria-label="Keys and touch" ref={ref}>
      <div className="ac-keys-top">
        <span className="ac-keys-title">{fine ? 'Keys' : 'Touch'}</span>
        <button type="button" className="ac-link" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="ac-keys-cols" data-first={fine ? 'keys' : 'touch'}>
        <List title="Keyboard" rows={keys} />
        <List title="Touch" rows={touch} />
      </div>
    </div>
  );
}

/**
 * The skin. Children are the media layer (the film, or a feed of films).
 * Props:
 *   title, meta        top left (meta: a short line under the title)
 *   onTitle            makes the title a link (the feed opens Credits with it)
 *   corner             top right; defaults to the time of day
 *   brand              top centre (optional)
 *   below              under the hairline, centred (optional)
 *   defaultFill        start filling the box (crop) instead of fitting the whole frame
 *   loop, onLoop       show a Loop switch
 *   onFullscreen, isFull, canFull   take over full screen (the feed fills the page)
 *   onNext, onPrev     a feed: ↑/↓ and N/P change film (volume moves to Shift ↑/↓)
 *   overlay            true while a page of the host covers the player (keys and idle pause)
 *   autoFocus          give the keyboard to the player at once
 *   tone               'adapt' (read the picture, default), 'dark' (always light ink), 'light' (always dark ink)
 *   soundGate, onSoundGate   the browser started the film silent: the next tap, click or key turns sound on
 *                      (inside that gesture, so every browser allows it) instead of playing or pausing
 */
export function AnticonSkin({
  children,
  title,
  meta,
  onTitle,
  corner,
  brand,
  below,
  defaultFill = false,
  loop,
  onLoop,
  onFullscreen,
  onNext,
  onPrev,
  isFull: isFullProp,
  canFull: canFullProp,
  overlay = false,
  autoFocus = false,
  tone: toneMode = 'adapt',
  rootRef,
  className = '',
  style,
  label,
  soundGate = false,
  onSoundGate,
}) {
  const store = usePlayer();
  const root = useRef(null);
  const setRoot = useCallback(
    (el) => {
      root.current = el;
      if (rootRef) rootRef.current = el;
    },
    [rootRef],
  );
  const fine = useMatch('(pointer: fine)');
  const paused = usePlayer((s) => s.paused);
  const ended = usePlayer((s) => s.ended);
  const waiting = usePlayer((s) => s.waiting);
  const t = usePlayer((s) => s.currentTime);
  const d = usePlayer((s) => s.duration);
  const muted = usePlayer((s) => s.muted);
  const volume = usePlayer((s) => s.volume);
  const volAvail = usePlayer((s) => s.volumeAvailability);
  const rate = usePlayer((s) => s.playbackRate);
  const ccShowing = usePlayer((s) => s.subtitlesShowing);
  const hasCC = usePlayer((s) => (s.textTrackList ?? []).some((tr) => tr.kind === 'captions' || tr.kind === 'subtitles'));
  const pipAvail = usePlayer((s) => s.pictureInPictureAvailability);
  const pip = usePlayer((s) => s.isPictureInPicture);
  const castAvail = usePlayer((s) => s.remotePlaybackAvailability);
  const castState = usePlayer((s) => s.remotePlaybackState);
  const fsAvail = usePlayer((s) => s.fullscreenAvailability);
  const fsOn = usePlayer((s) => s.isFullscreen);
  const controlsVisible = usePlayer((s) => s.controlsVisible);
  const [fillPref, setFillPref] = useState(null);
  const fill = fillPref ?? defaultFill;
  const [peek, setPeek] = useState(null);
  const idle = !controlsVisible && !paused && !overlay;
  const tone = useTone(root, toneMode, fill);

  const isFull = isFullProp ?? fsOn;
  const canFull = canFullProp ?? fsAvail === 'available';
  const toggleFull = useCallback(() => {
    if (onFullscreen) return onFullscreen();
    return (store.state.isFullscreen ? store.exitFullscreen() : store.requestFullscreen())?.catch?.(() => {});
  }, [onFullscreen, store]);

  useEffect(() => {
    if (autoFocus) root.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  // a mouse click on a word leaves the keyboard with the player, so Space still plays and pauses
  useEffect(() => {
    const el = root.current;
    const onUp = (e) => {
      if (e.pointerType !== 'mouse') return;
      if (e.target.closest?.('.ac-edges button, .ac-edges [role=slider]')) setTimeout(() => el.focus({ preventScroll: true }), 0);
      else if (live.current.soundGate && live.current.onSoundGate && !live.current.overlay && !e.target.closest?.('.ac-ix, .ac-keys, button, a')) live.current.onSoundGate();
    };
    el.addEventListener('pointerup', onUp);
    return () => el.removeEventListener('pointerup', onUp);
  }, []);

  // big words for keys and taps
  const [flash, setFlash] = useState(null);
  const flashTimer = useRef(0);
  const show = useCallback((text, side = 'center') => {
    clearTimeout(flashTimer.current);
    setFlash({ text, side, k: performance.now() });
    flashTimer.current = setTimeout(() => setFlash(null), 750);
  }, []);
  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    return subscribeToInputActions(el, (ev) => {
      const later = (fn) => setTimeout(() => show(fn(store.state)), 60);
      switch (ev.action) {
        case 'togglePaused':
          show(store.state.paused ? 'Pause' : 'Play');
          break;
        case 'seekStep': {
          const v = ev.value ?? 10;
          show(v < 0 ? `−${Math.abs(v)}` : `+${v}`, ev.source === 'gesture' ? (v < 0 ? 'left' : 'right') : 'center');
          break;
        }
        case 'toggleMuted':
          later((s) => (s.muted ? 'Silent' : 'Sound'));
          break;
        case 'toggleSubtitles':
          later((s) => (s.subtitlesShowing ? 'Captions' : 'No captions'));
          break;
        case 'speedUp':
        case 'speedDown':
          later((s) => `${s.playbackRate}×`);
          break;
        case 'toggleFullscreen':
          break;
        default:
      }
    });
  }, [store, show]);

  /* ---------- the keyboard: one key per thing, each answered with a big word ---------- */
  const [keysOpen, setKeysOpen] = useState(false);
  const live = useRef({});
  live.current = { toggleFull, onNext, onPrev, overlay, keysOpen, fill, show, soundGate, onSoundGate };
  useEffect(() => {
    const el = root.current;
    const vol = (dv) => {
      const v = Math.min(1, Math.max(0, store.state.volume + dv));
      store.setVolume(v);
      if (v > 0 && store.state.muted) store.setMuted(false);
      show(`Sound ${Math.round(v * 100)}`);
    };
    const onKey = (e) => {
      const L = live.current;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest?.('input, textarea, select')) return;
      if (L.keysOpen) {
        if (e.key === 'Escape' || e.key === '?') {
          e.preventDefault();
          e.stopPropagation();
          setKeysOpen(false);
        }
        return;
      }
      if (L.overlay) return;
      // silent by the browser's rule: any key turns sound on; Space or K does only that
      if (L.soundGate && L.onSoundGate && !e.repeat && !['Shift', 'Tab', 'Escape'].includes(e.key)) {
        L.onSoundGate();
        if (e.key === ' ' || e.key === 'k' || e.key === 'K' || e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
      const onSlider = !!e.target.closest?.('[role=slider]');
      const st = store.state;
      const dur = st.duration || 0;
      const k = e.key;
      let done = true;
      if (k === 'f' || k === 'F') L.toggleFull();
      else if (k === '?') setKeysOpen(true);
      else if (k === 'Escape' && st.isFullscreen) store.exitFullscreen()?.catch?.(() => {});
      else if ((k === 'ArrowUp' || k === 'ArrowDown') && !onSlider) {
        const up = k === 'ArrowUp';
        // the film changing is answer enough: no big word over the move
        if (L.onNext && !e.shiftKey) (up ? L.onPrev : L.onNext)();
        else vol(up ? 0.05 : -0.05);
      } else if ((k === 'n' || k === 'N') && L.onNext) {
        L.onNext();
      } else if ((k === 'p' || k === 'P') && L.onPrev) {
        L.onPrev();
      } else if ((k === 'ArrowLeft' || k === 'ArrowRight') && e.shiftKey && !onSlider) {
        const dv = k === 'ArrowRight' ? 30 : -30;
        store.seek(Math.min(dur, Math.max(0, st.currentTime + dv)));
        L.show(dv > 0 ? '+30' : '−30');
      } else if ((k === ',' || k === '.') && !onSlider) {
        store.pause();
        store.seek(Math.min(dur, Math.max(0, st.currentTime + (k === '.' ? 1 : -1) / 30)));
        L.show(k === '.' ? '+1 frame' : '−1 frame');
      } else if ((k === 'Home' || k === 'End') && !onSlider && dur) {
        store.seek(k === 'Home' ? 0 : Math.max(0, dur - 2));
        L.show(k === 'Home' ? 'Start' : 'End');
      } else done = false;
      if (done) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    el.addEventListener('keydown', onKey, true);
    return () => el.removeEventListener('keydown', onKey, true);
  }, [store]);

  /* ---------- touch: tap, double-tap, keep tapping, hold, slide, pinch ---------- */
  useEffect(() => {
    const el = root.current;
    const pts = new Map();
    let g = null; // the gesture under way
    let lastTap = null; // { t, side }
    let streak = null; // { side, total, until }
    let pending = 0;
    const SIDE = (x, r) => (x - r.left < r.width / 3 ? 'left' : x - r.left > (r.width * 2) / 3 ? 'right' : 'center');
    const onPicture = (e) => !e.target.closest?.('.ac-edges button, .ac-edges [role=slider], .ac-ix, .ac-keys');
    const toggle = () => {
      const p = store.state.paused || store.state.ended;
      (p ? store.play() : store.pause())?.catch?.(() => {});
      live.current.show(p ? 'Play' : 'Pause');
    };
    const down = (e) => {
      if (e.pointerType !== 'touch' || !onPicture(e) || live.current.overlay) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        // two fingers: a pinch decides fill or fit
        const [a, b2] = [...pts.values()];
        clearTimeout(g?.hold);
        g = { pinch: Math.hypot(a.x - b2.x, a.y - b2.y), done: false };
        return;
      }
      if (pts.size > 2) return;
      const r = el.getBoundingClientRect();
      g = { x: e.clientX, y: e.clientY, t: performance.now(), r, moved: false, scrub: null, holding: false, second: false };
      // a second finger-down on the same side, soon after a tap, is a double-tap: hold back the play/pause now,
      // not when the finger lifts, so a slow second tap never pauses the film on its way to +10
      if (lastTap && lastTap.side === SIDE(e.clientX, r) && g.t - lastTap.t < 320) {
        clearTimeout(pending);
        g.second = true;
      }
      // hold: twice the speed while the finger stays
      g.hold = setTimeout(() => {
        if (!g || g.moved || g.scrub) return;
        g.holding = { rate: store.state.playbackRate };
        store.setPlaybackRate(2);
        if (store.state.paused) store.play()?.catch?.(() => {});
        setFlash({ text: '2×', side: 'center', k: performance.now(), hold: true });
      }, 480);
    };
    const move = (e) => {
      if (e.pointerType !== 'touch' || !pts.has(e.pointerId) || !g) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (g.pinch != null) {
        if (g.done || pts.size < 2) return;
        const [a, b2] = [...pts.values()];
        const ratio = Math.hypot(a.x - b2.x, a.y - b2.y) / g.pinch;
        if (ratio > 1.18 || ratio < 0.85) {
          g.done = true;
          setFillPref(ratio > 1);
          live.current.show(ratio > 1 ? 'Fill' : 'Fit');
        }
        return;
      }
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      if (!g.moved && Math.hypot(dx, dy) > 10) {
        g.moved = true;
        clearTimeout(g.hold);
        // sideways: scrub; up or down: leave it to the page (or the feed)
        if (Math.abs(dx) > Math.abs(dy) * 1.3 && store.state.duration > 0) g.scrub = { from: store.state.currentTime };
      }
      if (g.scrub) {
        const dur = store.state.duration;
        const span = Math.min(dur, 180); // a full swipe across the player covers up to three minutes
        g.scrub.to = Math.min(dur, Math.max(0, g.scrub.from + (dx / g.r.width) * span));
        setPeek(g.scrub.to);
      }
    };
    const up = (e) => {
      if (e.pointerType !== 'touch' || !pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (!g) return;
      clearTimeout(g.hold);
      if (g.pinch != null) {
        if (pts.size === 0) g = null;
        return;
      }
      const G = g;
      g = null;
      if (G.second && (G.moved || G.holding)) lastTap = null;
      if (e.type === 'pointercancel') {
        if (G.holding) store.setPlaybackRate(G.holding.rate);
        setPeek(null);
        return;
      }
      if (G.holding) {
        store.setPlaybackRate(G.holding.rate);
        setFlash(null);
        return;
      }
      if (G.scrub) {
        if (G.scrub.to != null) {
          store.seek(G.scrub.to);
          const dv = Math.round(G.scrub.to - G.scrub.from);
          live.current.show(`${dv < 0 ? '−' : '+'}${Math.abs(dv)} s`);
        }
        setPeek(null);
        return;
      }
      if (G.moved) return;
      if (live.current.soundGate && live.current.onSoundGate) {
        // the first tap after the browser silenced the film: sound, not pause
        clearTimeout(pending);
        lastTap = null;
        live.current.onSoundGate();
        return;
      }
      const now = performance.now();
      const side = SIDE(e.clientX, G.r);
      // keep tapping a side after a double-tap: ten more seconds each time
      if (streak && streak.side === side && now < streak.until && side !== 'center') {
        streak.total += 10;
        streak.until = now + 700;
        store.seek(Math.min(store.state.duration || 0, Math.max(0, store.state.currentTime + (side === 'left' ? -10 : 10))));
        live.current.show(`${side === 'left' ? '−' : '+'}${streak.total}`, side);
        return;
      }
      if (G.second || (lastTap && lastTap.side === side && now - lastTap.t < 320)) {
        clearTimeout(pending);
        lastTap = null;
        if (side === 'center') {
          setFillPref(!live.current.fill);
          live.current.show(live.current.fill ? 'Fit' : 'Fill');
          return;
        }
        streak = { side, total: 10, until: now + 700 };
        store.seek(Math.min(store.state.duration || 0, Math.max(0, store.state.currentTime + (side === 'left' ? -10 : 10))));
        live.current.show(side === 'left' ? '−10' : '+10', side);
        return;
      }
      lastTap = { t: now, side };
      clearTimeout(pending);
      pending = setTimeout(() => {
        lastTap = null;
        toggle();
      }, 320);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      clearTimeout(pending);
    };
  }, [store, show]);

  // mouse: a double-click on the picture is full screen (the single clicks play and pause, as everywhere)
  useEffect(() => {
    const el = root.current;
    const dbl = (e) => {
      if (live.current.overlay || e.target.closest?.('.ac-edges button, .ac-edges [role=slider], .ac-ix, .ac-keys')) return;
      live.current.toggleFull();
    };
    el.addEventListener('dblclick', dbl);
    return () => el.removeEventListener('dblclick', dbl);
  }, []);

  const seekBy = (s) => store.seek(Math.min(d || 0, Math.max(0, (t || 0) + s)));
  const playWord = waiting && !paused ? 'Loading' : ended ? 'Replay' : paused ? 'Play' : 'Pause';
  const TitleTag = onTitle ? 'button' : 'div';

  return (
    <Container
      ref={setRoot}
      className={`ac ${className}`.trim()}
      style={style}
      tabIndex={-1}
      data-fill={fill || undefined}
      data-idle={idle || undefined}
      data-fine={fine || undefined}
      data-overlay={overlay || keysOpen || undefined}
      data-tone-mode={toneMode}
      data-tone-tl={tone.tl}
      data-tone-tc={tone.tc}
      data-tone-tr={tone.tr}
      data-veil-top={tone.veilTop}
      data-veil-bottom={tone.veilBottom}
      data-tone-bottom={tone.bottom}
      data-tone-left={tone.left}
      data-tone-right={tone.right}
      data-tone-center={tone.center}
      aria-label={label ?? `Video player${title ? `, ${title}` : ''}`}
    >
      {children}

      <div className="ac-edges">
        <div className="ac-tl">
          {title && (
            <TitleTag type={onTitle ? 'button' : undefined} className="ac-title" onClick={onTitle} aria-haspopup={onTitle ? 'dialog' : undefined}>
              {title}
            </TitleTag>
          )}
          {meta && <span className="ac-mono ac-dim">{meta}</span>}
        </div>
        {brand && <div className="ac-tc">{brand}</div>}
        <div className="ac-tr">
          {corner === undefined ? <Clock /> : corner}
          <button type="button" className="ac-link ac-help" onClick={() => setKeysOpen(true)} aria-haspopup="dialog" aria-keyshortcuts="?">
            {fine ? 'Keys' : 'Touch'}
          </button>
        </div>

        {/* left edge, read upward: what the film does */}
        <div className="ac-left" role="group" aria-label="Playback">
          <Act onClick={() => (paused || ended ? store.play()?.catch?.(() => {}) : store.pause())} label={playWord} wide>
            {playWord}
          </Act>
          <Act onClick={() => seekBy(-10)} label="Back 10 seconds" pri="2">
            −10
          </Act>
          <Act onClick={() => seekBy(10)} label="Forward 10 seconds" pri="2">
            +10
          </Act>
          <Act onClick={() => store.setPlaybackRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length] ?? 1)} label={`Speed ${rate} times. Change speed`} pri="3">
            {rate}×
          </Act>
          <Word on={ccShowing} hidden={!hasCC} onClick={() => store.toggleSubtitles()} label="Captions" pri="3">
            CC
          </Word>
          {onLoop && (
            <Word on={!!loop} onClick={() => onLoop(!loop)} label="Loop" pri="3">
              Loop
            </Word>
          )}
        </div>

        {/* right edge, read downward: how you see and hear it */}
        <div className="ac-right" role="group" aria-label="View and sound">
          <span className="ac-pair">
            <Word on={!muted} onClick={() => store.setMuted(!muted)} label="Sound">
              Sound
            </Word>
            {volAvail === 'available' && <VolumeNumber value={muted ? 0 : volume} />}
          </span>
          <Word on={fill} onClick={() => setFillPref(!fill)} label="Fill the frame" pri="2">
            Fill
          </Word>
          <Word on={pip} hidden={pipAvail !== 'available'} onClick={() => (pip ? store.exitPictureInPicture() : store.requestPictureInPicture())?.catch?.(() => {})} label="Picture in picture" pri="3">
            PiP
          </Word>
          <Word on={castState === 'connected'} hidden={castAvail !== 'available'} onClick={() => store.promptRemotePlayback()?.catch?.(() => {})} label="Cast" pri="3">
            Cast
          </Word>
          <Word on={isFull} hidden={!canFull} onClick={toggleFull} label="Full screen">
            Full
          </Word>
        </div>

        {/* bottom: the time, the hairline, the length */}
        <div className="ac-bottom">
          <div className="ac-baseline">
            <span className="ac-mono ac-t">{clock(t)}</span>
            <Scrub onPeek={setPeek} />
            <span className="ac-mono ac-t ac-dim">{clock(d)}</span>
          </div>
          {below && <div className="ac-below">{below}</div>}
        </div>
      </div>

      {peek != null && (
        <span className="ac-bigtime" aria-hidden="true">
          {clock(peek)}
        </span>
      )}
      {flash && (
        <p className="ac-flash" data-side={flash.side} key={flash.k} aria-hidden="true">
          {flash.text}
        </p>
      )}
      {fine && <Cursor root={root} />}
      {keysOpen && <KeysSheet feed={!!onNext} fine={fine} onClose={() => { setKeysOpen(false); root.current?.focus({ preventScroll: true }); }} />}

      <Gesture type="tap" action="togglePaused" pointer="mouse" disabled={soundGate} />

      <Hotkey keys="Space" action="togglePaused" disabled={overlay || keysOpen} />
      <Hotkey keys="k" action="togglePaused" disabled={overlay || keysOpen} />
      <Hotkey keys="m" action="toggleMuted" disabled={overlay || keysOpen} />
      <Hotkey keys="c" action="toggleSubtitles" disabled={overlay || keysOpen} />
      <Hotkey keys="i" action="togglePictureInPicture" disabled={overlay || keysOpen} />
      <Hotkey keys="ArrowLeft" action="seekStep" value={-10} disabled={overlay || keysOpen} />
      <Hotkey keys="ArrowRight" action="seekStep" value={10} disabled={overlay || keysOpen} />
      <Hotkey keys="j" action="seekStep" value={-10} disabled={overlay || keysOpen} />
      <Hotkey keys="l" action="seekStep" value={10} disabled={overlay || keysOpen} />
      <Hotkey keys="0-9" action="seekToPercent" disabled={overlay || keysOpen} />
      <Hotkey keys=">" action="speedUp" disabled={overlay || keysOpen} />
      <Hotkey keys="<" action="speedDown" disabled={overlay || keysOpen} />

      <div className="ac-sr">
        <StatusAnnouncer />
      </div>
    </Container>
  );
}

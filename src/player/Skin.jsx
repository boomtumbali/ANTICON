import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Container, Hotkey, StatusAnnouncer, useActiveTextCues, useQualityOptions } from '@videojs/react';
import { subscribeToInputActions } from '@videojs/core/dom';
import { usePlayer } from './core.js';
import { frameAt, useStoryboard } from './storyboard.js';

/*
 * ANTICON's skin: a player with no icons. Words and numbers, set like a
 * poster on the edges of the player's own box.
 *
 *   top left      the title, and a line about it
 *   top right     a slot (when the film will end, or whatever the page puts there)
 *   left edge     what the film does: play, back, forward, speed, captions, loop (read upward)
 *   right edge    how you see and hear it: sound, fill, quality, picture in picture, cast, full (read downward)
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
function useTone(root, fill) {
  const [tone, setTone] = useState({});
  useEffect(() => {
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
      // the same fit as on screen; the bands around a fitted film are black
      const s = (fill ? Math.max : Math.min)(W / v.videoWidth, H / v.videoHeight);
      const dw = v.videoWidth * s;
      const dh = v.videoHeight * s;
      const py0 = Math.max(0, (H - dh) / 2 / H); // where the picture starts and ends, as fractions of the box
      const py1 = Math.min(1, 1 - (H - dh) / 2 / H);
      const px0 = Math.max(0, (W - dw) / 2 / W);
      const px1 = Math.min(1, 1 - (W - dw) / 2 / W);
      // the veils start where the picture starts, so a letterbox band never turns grey
      const pt = `${Math.round(py0 * bh)}px`;
      const pb = `${Math.round((1 - py1) * bh)}px`;
      if (host.style.getPropertyValue('--pic-t') !== pt) host.style.setProperty('--pic-t', pt);
      if (host.style.getPropertyValue('--pic-b') !== pb) host.style.setProperty('--pic-b', pb);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      try {
        ctx.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh);
        let px = ctx.getImageData(0, 0, W, H).data;
        const next0 = {};
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
        // Mattes. Solid ink cannot read across a thin black band and a bright picture at once (half of each letter
        // would vanish). Where a fitted film leaves a band thinner than the words along that edge, and the picture
        // just past the band is bright, the band grows (solid black, no shadow) until it holds the words.
        const hr = host.getBoundingClientRect();
        const reach = (sel, side) => {
          let m = 0;
          for (const n of host.querySelectorAll(sel)) {
            const r = n.getBoundingClientRect();
            if (!r.width || !r.height) continue;
            m = Math.max(m, side === 't' ? r.bottom - hr.top : side === 'b' ? hr.bottom - r.top : side === 'l' ? r.right - hr.left : hr.right - r.left);
          }
          return m;
        };
        const mats = {};
        const sides = [
          ['t', py0, '.ac-tl, .ac-tc, .ac-tr', hr.height, (f) => [0, py0, 1, f]],
          ['b', 1 - py1, '.ac-bottom', hr.height, (f) => [0, 1 - f, 1, py1]],
          ['l', px0, '.ac-left', hr.width, (f) => [px0, 0, f, 1]],
          ['r', 1 - px1, '.ac-right', hr.width, (f) => [1 - f, 0, px1, 1]],
        ];
        for (const [side, band, sel, size, strip] of sides) {
          const need = size ? (reach(sel, side) + 6) / size : 0;
          let on = false;
          if (band > 0.002 && need > band && need < 0.5) {
            const [lum] = lumOf(strip(need));
            on = lum > (last[`mat${side}`] ? 0.36 : 0.44);
          }
          mats[side] = on ? need : 0;
          next0[`mat${side}`] = on;
        }
        for (const side of ['t', 'b', 'l', 'r']) {
          const val = `${Math.round(mats[side] * (side === 't' || side === 'b' ? bh : bw))}px`;
          if (host.style.getPropertyValue(`--mat-${side}`) !== val) host.style.setProperty(`--mat-${side}`, val);
        }
        if (mats.t || mats.b || mats.l || mats.r) {
          ctx.fillStyle = '#000';
          if (mats.t) ctx.fillRect(0, 0, W, mats.t * H);
          if (mats.b) ctx.fillRect(0, H - mats.b * H, W, mats.b * H);
          if (mats.l) ctx.fillRect(0, 0, mats.l * W, H);
          if (mats.r) ctx.fillRect(W - mats.r * W, 0, mats.r * W, H);
          px = ctx.getImageData(0, 0, W, H).data;
        }
        const zones = zonesOf(host);
        // and the picture under each veil
        zones.veilTop = [0, py0, 1, Math.min(py1, py0 + 0.2)];
        zones.veilBottom = [0, Math.max(py0, py1 - 0.24), 1, py1];
        const next = { ...next0 };
        for (const [name, rect] of Object.entries(zones)) {
          const was = last[name] === 'light';
          const [lum] = lumOf(rect);
          // solid ink only, no halo and no veil: white over a dark picture, black over a bright one, switching
          // at the middle of the scale (where each reads about as well), with a little hysteresis against flicker
          next[name] = lum > (was ? 0.44 : 0.56) ? 'light' : 'dark';
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
  }, [root, fill]);
  return tone;
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

/**
 * Quality, as a word: AUTO (with the height playing now, dim) or the height
 * you chose, 1080P, 720P... Each click steps to the next: Auto, then the
 * highest, down to the lowest, then Auto again. Only shown when the stream
 * offers more than one.
 */
// Auto first, then the sizes from the highest down (whatever order the stream lists them in)
const qualityOrder = (q) => {
  const px = (o) => parseInt(o.label, 10) || 0;
  return [...q.options].sort((a, b) => (a.value === 'auto' ? -1 : b.value === 'auto' ? 1 : px(b) - px(a)));
};
function QualityWord({ q, active, pri }) {
  if (!q || q.hidden || q.options.length < 3) return null;
  const opts = qualityOrder(q);
  const auto = q.value === 'auto';
  const word = (o) => (o.value === 'auto' ? 'Auto' : o.label);
  const i = Math.max(0, opts.findIndex((o) => o.value === q.value));
  const next = opts[(i + 1) % opts.length];
  return (
    <button type="button" className="ac-word ac-act ac-q" data-pri={pri} onClick={() => q.setValue(next.value)} aria-label={`Quality ${auto ? 'automatic' : word(opts[i])}. Change to ${word(next)}`}>
      <span>
        {auto ? 'Auto' : word(opts[i])}
        {auto && active?.height ? <span className="ac-dim"> {active.height}</span> : null}
      </span>
    </button>
  );
}
export const stepQuality = (q) => {
  if (!q || q.hidden || q.options.length < 3) return null;
  const opts = qualityOrder(q);
  const i = Math.max(0, opts.findIndex((o) => o.value === q.value));
  const next = opts[(i + 1) % opts.length];
  q.setValue(next.value);
  return next.value === 'auto' ? 'Auto' : next.label;
};

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

/**
 * The filmstrip: while you scrub, the film's own frames run across the middle
 * of the picture as one continuous strip. The frame under the centre line is
 * the moment you are pointing at; the strip slides with you, eased, so it
 * glides rather than jumps. It opens out of a hairline and closes back into one.
 */
function Filmstrip({ peek, sb, duration }) {
  const band = useRef(null);
  const track = useRef(null);
  const label = useRef(null);
  const cur = useRef(null);
  const target = useRef(0);
  const raf = useRef(0);
  const [w, setW] = useState(0);
  const [act, setAct] = useState(-1);
  const open = peek != null;
  useEffect(() => {
    const el = band.current;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // about five frames across, never tiny, never huge
  const tw = Math.round(Math.min(400, Math.max(132, w / 4.8)));
  const th = Math.round((tw * sb.tile_height) / sb.tile_width);
  const k = tw / sb.tile_width;
  useEffect(() => {
    if (!open || !tw) return;
    const { i, f } = frameAt(sb, peek);
    target.current = w / 2 - (i + f) * tw;
    setAct(i);
    if (cur.current == null) cur.current = target.current;
    cancelAnimationFrame(raf.current);
    const tick = () => {
      const d = target.current - cur.current;
      cur.current += Math.abs(d) < 0.4 ? d : d * 0.22;
      if (track.current) track.current.style.transform = `translate3d(${cur.current.toFixed(2)}px, 0, 0)`;
      if (cur.current !== target.current) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [peek, open, sb, w, tw]);
  // closed: the next opening starts where you point, not sliding in from the last place
  useEffect(() => {
    if (open) return undefined;
    const id = setTimeout(() => (cur.current = null), 400);
    return () => clearTimeout(id);
  }, [open]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return (
    <div className="ac-strip" data-open={open || undefined} style={{ '--th': `${th}px` }} aria-hidden="true">
      <div className="ac-strip-dim" />
      <div className="ac-strip-band" ref={band}>
        <div className="ac-strip-track" ref={track} style={{ width: sb.tiles.length * tw }}>
          {sb.tiles.map((tile, i) => (
            <span
              key={i}
              className="ac-tile"
              data-on={i === act || undefined}
              style={{
                left: i * tw,
                width: tw,
                height: th,
                backgroundImage: `url(${sb.url})`,
                backgroundSize: `${sb.w * k}px ${sb.h * k}px`,
                backgroundPosition: `${-tile.x * k}px ${-tile.y * k}px`,
              }}
            />
          ))}
        </div>
      </div>
      <span className="ac-strip-x" />
      <span className="ac-strip-t ac-mono" ref={label}>
        <span className="ac-strip-at">{open ? clock(peek) : ''}</span>
        <span className="ac-strip-of ac-dim">{clock(duration)}</span>
      </span>
    </div>
  );
}

/**
 * Share: the link, a word to copy it, and the places to post it, all words.
 * The feed shares each film's own page (/film/<id>), which link previews show
 * with that film's card; "From 02:41" adds where you are in the film.
 * Where the device has its own share sheet (phones), "More" opens it.
 */
function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return new Promise((res, rej) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy') ? res() : rej(new Error('copy'));
    } catch (e) {
      rej(e);
    } finally {
      ta.remove();
    }
  });
}
function SharePanel({ share, t, onClose }) {
  const ref = useRef(null);
  const [at, setAt] = useState(false);
  const [copied, setCopied] = useState(null); // 'yes' | 'no'
  useEffect(() => {
    ref.current?.querySelector('.ac-share-copy')?.focus({ preventScroll: true });
  }, []);
  const start = Math.floor(t || 0);
  const url = share.timed && at && start > 0 ? `${share.url}${share.url.includes('?') ? '&' : '?'}t=${start}` : share.url;
  const text = share.text || share.title || 'ANTICON';
  const enc = encodeURIComponent;
  const places = [
    ['X', `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`],
    ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`],
    ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`],
    ['WhatsApp', `https://wa.me/?text=${enc(`${text} ${url}`)}`],
    ['Email', `mailto:?subject=${enc(text)}&body=${enc(url)}`],
  ];
  const native = typeof navigator !== 'undefined' && !!navigator.share;
  const copy = () =>
    copyText(url).then(
      () => setCopied('yes'),
      () => setCopied('no'),
    );
  useEffect(() => {
    if (!copied) return undefined;
    const id = setTimeout(() => setCopied(null), 2200);
    return () => clearTimeout(id);
  }, [copied]);
  return (
    <div className="ac-share" role="dialog" aria-modal="true" aria-label="Share" ref={ref}>
      <div className="ac-keys-top">
        <span className="ac-keys-title">Share</span>
        <button type="button" className="ac-link" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="ac-share-body">
        {share.title && <p className="ac-share-name">{share.title}</p>}
        <p className="ac-share-url ac-mono">{url}</p>
        <div className="ac-share-row">
          <button type="button" className="ac-share-word ac-share-copy" onClick={copy}>
            <span>{copied === 'yes' ? 'Copied' : copied === 'no' ? 'Select and copy above' : 'Copy link'}</span>
          </button>
          {share.timed && start > 0 && (
            <button type="button" className="ac-share-word" aria-pressed={at} data-off={!at || undefined} onClick={() => setAt(!at)}>
              <span>From {clock(start)}</span>
            </button>
          )}
        </div>
        <div className="ac-share-row ac-share-places">
          {places.map(([name, href]) => (
            <a key={name} className="ac-share-word" href={href} target="_blank" rel="noreferrer noopener">
              <span>{name}</span>
            </a>
          ))}
          {native && (
            <button type="button" className="ac-share-word" onClick={() => navigator.share({ title: share.title, text, url }).catch(() => {})}>
              <span>More</span>
            </button>
          )}
        </div>
        <span className="ac-sr" aria-live="polite">
          {copied === 'yes' ? 'Link copied' : ''}
        </span>
      </div>
    </div>
  );
}

/** Every key and every touch, as a list. Opens with ? or the word in the corner; Esc closes. */
/* Captions. The stream's own caption track, read through Video.js (useActiveTextCues) and set by the skin,
   so they look the same in every browser and always clear the time, the line and the words along the bottom.
   The browser's own drawing of them is hidden in anticon.css, except where only the browser can draw:
   iOS full screen and picture in picture (the video is marked data-native-view there). */
const CC_TRACKS = (tr) => (tr.kind === 'captions' || tr.kind === 'subtitles') && tr.mode === 'showing';
const ENTITIES = { amp: '&', lt: '<', gt: '>', nbsp: ' ', quot: '"', apos: "'", lrm: '', rlm: '' };
function cueLines(cues) {
  const out = [];
  for (const c of cues)
    for (const raw of String(c.text || '').split(/\r?\n/)) {
      const line = raw
        .replace(/<[^>]*>/g, '')
        .replace(/&(\w+);/g, (m, k) => (k in ENTITIES ? ENTITIES[k] : m))
        .replace(/\s+/g, ' ')
        .trim();
      if (line && !out.includes(line)) out.push(line);
    }
  return out;
}
function Captions({ on, root, layout }) {
  const cues = useActiveTextCues(CC_TRACKS);
  const lines = useMemo(() => (on ? cueLines(cues) : []), [on, cues]);
  const box = useRef(null);

  // the native views draw their own captions: let the browser show them there
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const mark = (e) => {
      const v = e.target;
      if (!(v instanceof HTMLVideoElement)) return;
      const native =
        e.type === 'webkitbeginfullscreen' || e.type === 'enterpictureinpicture' ||
        (e.type === 'webkitpresentationmodechanged' && v.webkitPresentationMode && v.webkitPresentationMode !== 'inline');
      v.toggleAttribute('data-native-view', native);
    };
    const types = ['webkitbeginfullscreen', 'webkitendfullscreen', 'enterpictureinpicture', 'leavepictureinpicture', 'webkitpresentationmodechanged'];
    types.forEach((t) => el.addEventListener(t, mark, true));
    return () => types.forEach((t) => el.removeEventListener(t, mark, true));
  }, [root]);

  // how high the words along the bottom reach, over the captions' own width: measured, so the captions
  // clear them in every layout (tall, short, phone, thumbnail) and sit low again when the words fade
  useLayoutEffect(() => {
    const el = root.current, cc = box.current;
    if (!el || !cc || !on) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (!r.height) return;
      const c = cc.getBoundingClientRect();
      const gap = Math.max(8, Math.min(18, r.height * 0.018));
      const bottom = el.querySelector('.ac-bottom');
      const eb = bottom ? parseFloat(getComputedStyle(bottom).bottom) || 0 : 0;
      let up = eb;
      for (const n of el.querySelectorAll('.ac-bottom, .ac-left, .ac-right')) {
        const b = n.getBoundingClientRect();
        if (!b.height || b.right <= c.left || b.left >= c.right || b.top < r.top + r.height * 0.45) continue;
        up = Math.max(up, r.bottom - b.top);
      }
      const gate = el.querySelector('.ac-below .ac-gate');
      const rest = gate ? r.bottom - gate.closest('.ac-below').getBoundingClientRect().top : eb;
      cc.style.setProperty('--cc-up', `${Math.round(up + gap)}px`);
      cc.style.setProperty('--cc-rest', `${Math.round(Math.max(rest, eb) + gap * 0.5)}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const bottom = el.querySelector('.ac-bottom');
    if (bottom) ro.observe(bottom); // the line under the hairline comes and goes
    return () => ro.disconnect();
  }, [root, on, layout, lines.length]);

  if (!on) return null;
  return (
    <div className="ac-cc" ref={box} aria-hidden="true">
      {lines.length > 0 && (
        <p>
          {lines.map((l, i) => (
            <span key={i}>
              <span className="ac-cc-l">{l}</span>
              {i < lines.length - 1 && <br />}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

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
    ['↑  ↓', 'Volume'],
    ['M', 'Sound on or off'],
    ['Q', 'Quality: Auto, then each size the stream offers'],
    ['C', 'Captions'],
    ['<  >', 'Slower, faster'],
    ['F   double-click', 'Full screen'],
    ['I', 'Picture in picture'],
    ['?   Esc', 'This list, close'],
    ['Drag sideways', 'Scrub, with the film\'s frames'],
    ['Drag up or down', 'Volume'],
    feed ? ['Wheel   Index', 'Next or previous film'] : null,
  ].filter(Boolean);
  const touch = [
    ['Tap', 'Play or pause'],
    ['Double-tap a side', '10 seconds back or forward'],
    ['Keep tapping', '10 more each time'],
    ['Double-tap the middle', 'Fill or fit'],
    ['Hold', 'Twice the speed, while you hold'],
    ['Slide sideways', 'Scrub, up to three minutes across'],
    ['Hold, then slide up or down', 'Volume'],
    ['Hold, then slide sideways', 'Scrub'],
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
 *   corner             top right, before Share and Keys (optional)
 *   brand              top centre (optional)
 *   below              under the hairline, centred (optional)
 *   defaultFill        start filling the box (crop) instead of fitting the whole frame
 *   loop, onLoop       show a Loop switch
 *   onFullscreen, isFull, canFull   take over full screen (the feed fills the page)
 *   onNext, onPrev     a feed (the keys list then mentions the wheel; ↑/↓ stay volume, as everywhere)
 *   overlay            true while a page of the host covers the player (keys and idle pause)
 *   autoFocus          give the keyboard to the player at once
 *   storyboard         a storyboard address (Mux: storyboard.json): scrubbing shows the film's frames as a strip
 *   share              { url, title, text, timed } for the Share word (default: this page); false hides it
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
  rootRef,
  className = '',
  style,
  label,
  soundGate = false,
  onSoundGate,
  storyboard,
  share,
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
  const q = useQualityOptions();
  const activeRendition = usePlayer((s) => s.activeVideoRendition);
  const [fillPref, setFillPref] = useState(null);
  const fill = fillPref ?? defaultFill;
  const [peek, setPeek] = useState(null);
  const idle = !controlsVisible && !paused && !overlay;
  const tone = useTone(root, fill);
  const sb = useStoryboard(storyboard);

  const isFull = isFullProp ?? fsOn;
  const canFull = canFullProp ?? fsAvail === 'available';
  const toggleFull = useCallback(() => {
    if (onFullscreen) return onFullscreen();
    return (store.state.isFullscreen ? store.exitFullscreen() : store.requestFullscreen())?.catch?.(() => {});
  }, [onFullscreen, store]);

  useEffect(() => {
    if (autoFocus) root.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  /* ---------- the mouse: a click plays or pauses; a drag sideways scrubs; a drag up or down is the volume ---------- */
  useEffect(() => {
    const el = root.current;
    let m = null;
    const onWord = (e) => !!e.target.closest?.('.ac-edges button, .ac-edges a, .ac-edges [role=slider], .ac-ix, .ac-keys, .ac-cr, .ac-share');
    const down = (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      if (onWord(e)) return;
      if (live.current.overlay) return;
      m = { id: e.pointerId, x: e.clientX, y: e.clientY, r: el.getBoundingClientRect(), mode: null };
    };
    const move = (e) => {
      if (!m || e.pointerId !== m.id) return;
      const dx = e.clientX - m.x;
      const dy = e.clientY - m.y;
      if (!m.mode) {
        if (Math.hypot(dx, dy) < 8) return;
        m.mode = Math.abs(dx) >= Math.abs(dy) ? 'scrub' : 'vol';
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* fine */
        }
        if (m.mode === 'scrub') {
          if (!(store.state.duration > 0)) return (m.mode = 'none');
          m.from = store.state.currentTime;
        } else m.from = store.state.muted ? 0 : store.state.volume;
      }
      live.current.drag(m, dx, dy);
    };
    const up = (e) => {
      if (!m || e.pointerId !== m.id) return;
      const M = m;
      m = null;
      if (M.mode) {
        live.current.dragEnd(M, e.type === 'pointercancel');
        return;
      }
      if (e.type === 'pointercancel') return;
      // a plain click on the picture
      if (live.current.soundGate && live.current.onSoundGate) live.current.onSoundGate();
      else live.current.toggle();
    };
    // a click on a word leaves the keyboard with the player, so Space still plays and pauses
    const refocus = (e) => {
      // (not for a word that opens a sheet: the sheet takes the focus)
      if (e.pointerType === 'mouse' && e.target.closest?.('.ac-edges button, .ac-edges [role=slider]') && !e.target.closest?.('[aria-haspopup]')) setTimeout(() => el.focus({ preventScroll: true }), 0);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerup', refocus);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('pointerup', refocus);
    };
  }, [store]);

  // big words for keys and taps
  const [flash, setFlash] = useState(null);
  const flashTimer = useRef(0);
  const show = useCallback((text, side = 'center', level) => {
    clearTimeout(flashTimer.current);
    setFlash({ text, side, level, k: performance.now() });
    flashTimer.current = setTimeout(() => setFlash(null), 750);
  }, []);
  // held on screen while a drag sets the volume; the line under it shows how loud
  const showHeld = useCallback((text, level) => {
    clearTimeout(flashTimer.current);
    setFlash((f) => ({ text, side: 'center', level, k: f?.held ? f.k : performance.now(), held: true }));
  }, []);
  const release = useCallback((ms = 650) => {
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), ms);
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
  const [shareOpen, setShareOpen] = useState(false);
  const shareInfo =
    share === false
      ? null
      : share ?? (typeof location !== 'undefined' ? { url: location.origin + location.pathname, title: title ?? 'ANTICON', text: title ? `${title}, on ANTICON` : 'ANTICON' } : null);
  const live = useRef({});
  const toggle = useCallback(() => {
    const p = store.state.paused || store.state.ended;
    (p ? store.play() : store.pause())?.catch?.(() => {});
    show(p ? 'Play' : 'Pause');
  }, [store, show]);
  // a drag on the picture, by mouse or by a held finger: sideways scrubs (the strip shows the frames), up or down is the volume
  const drag = useCallback(
    (g, dx, dy) => {
      const r = g.r;
      if (g.mode === 'scrub') {
        const dur = store.state.duration;
        const span = Math.min(dur, 180); // the width of the player covers up to three minutes
        g.to = Math.min(dur, Math.max(0, g.from + (dx / r.width) * span));
        setPeek(g.to);
      } else if (g.mode === 'vol') {
        if (store.state.volumeAvailability !== 'available') {
          showHeld('Use the volume buttons');
          return;
        }
        // half the player's height takes it from silent to full
        const v = Math.min(1, Math.max(0, g.from - dy / Math.max(120, r.height * 0.5)));
        store.setVolume(v);
        if (v > 0 && store.state.muted) store.setMuted(false);
        if (v === 0 && !store.state.muted) store.setMuted(true);
        showHeld(v === 0 ? 'Silent' : `Sound ${Math.round(v * 100)}`, v);
      }
    },
    [store, showHeld],
  );
  const dragEnd = useCallback(
    (g, cancelled) => {
      if (g.mode === 'scrub') {
        if (!cancelled && g.to != null) {
          store.seek(g.to);
          const dv = Math.round(g.to - g.from);
          show(`${dv < 0 ? '−' : '+'}${Math.abs(dv)} s`);
        }
        setPeek(null);
      } else if (g.mode === 'vol') release();
    },
    [store, show, release],
  );
  live.current = { toggleFull, onNext, onPrev, overlay: overlay || shareOpen, shareOpen, keysOpen, fill, show, soundGate, onSoundGate, q, toggle, drag, dragEnd };
  useEffect(() => {
    const el = root.current;
    const vol = (dv) => {
      const base = store.state.muted ? 0 : store.state.volume;
      const v = Math.min(1, Math.max(0, base + dv));
      store.setVolume(v);
      if (v > 0 && store.state.muted) store.setMuted(false);
      if (v === 0) store.setMuted(true);
      show(`Sound ${Math.round(v * 100)}`, 'center', v);
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
      if (L.shareOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setShareOpen(false);
          el.focus({ preventScroll: true });
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
      else if ((k === 'ArrowUp' || k === 'ArrowDown') && !onSlider) vol(k === 'ArrowUp' ? 0.05 : -0.05);
      else if (k === 'q' || k === 'Q') {
        const w = stepQuality(L.q);
        if (w) L.show(w);
        else done = false;
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

  /* ---------- touch: tap, double-tap, keep tapping, hold, slide, hold-and-slide, pinch ---------- */
  useEffect(() => {
    const el = root.current;
    const pts = new Map();
    let g = null; // the gesture under way
    let lastTap = null; // { t, side }
    let streak = null; // { side, total, until }
    let pending = 0;
    const SIDE = (x, r) => (x - r.left < r.width / 3 ? 'left' : x - r.left > (r.width * 2) / 3 ? 'right' : 'center');
    const onPicture = (e) => !e.target.closest?.('.ac-edges button, .ac-edges a, .ac-edges [role=slider], .ac-ix, .ac-keys, .ac-cr, .ac-share');
    const endHold = (G) => {
      if (G?.holding) {
        store.setPlaybackRate(G.holding.rate);
        G.holding = null;
        setFlash(null);
      }
      delete el.dataset.gesture;
    };
    const down = (e) => {
      if (e.pointerType !== 'touch' || !onPicture(e) || live.current.overlay) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        // two fingers: a pinch decides fill or fit
        const [a, b2] = [...pts.values()];
        clearTimeout(g?.hold);
        endHold(g);
        g = { pinch: Math.hypot(a.x - b2.x, a.y - b2.y), done: false };
        return;
      }
      if (pts.size > 2) return;
      const r = el.getBoundingClientRect();
      g = { x: e.clientX, y: e.clientY, t: performance.now(), r, moved: false, mode: null, held: false, holding: null, second: false };
      // a second finger-down on the same side, soon after a tap, is a double-tap: hold back the play/pause now,
      // not when the finger lifts, so a slow second tap never pauses the film on its way to +10
      if (lastTap && lastTap.side === SIDE(e.clientX, r) && g.t - lastTap.t < 320) {
        clearTimeout(pending);
        g.second = true;
      }
      // hold: twice the speed while the finger stays; and from here a slide is scrub (sideways) or volume (up or down)
      g.hold = setTimeout(() => {
        if (!g || g.moved) return;
        g.held = true;
        el.dataset.gesture = 'held'; // the feed leaves a held finger alone
        g.holding = { rate: store.state.playbackRate };
        store.setPlaybackRate(2);
        if (store.state.paused) store.play()?.catch?.(() => {});
        setFlash({ text: '2×', side: 'center', k: performance.now(), hold: true });
      }, 450);
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
        const sideways = Math.abs(dx) > Math.abs(dy) * 1.3;
        if (g.held) {
          // held, then slid: the 2× stops, and the slide takes over
          endHold(g);
          el.dataset.gesture = 'held';
          g.mode = sideways ? 'scrub' : 'vol';
        } else if (sideways) g.mode = 'scrub';
        // a quick slide up or down (not held) belongs to the page, or to the feed
        if (g.mode === 'scrub') {
          if (store.state.duration > 0) g.from = store.state.currentTime;
          else g.mode = null;
        } else if (g.mode === 'vol') g.from = store.state.muted ? 0 : store.state.volume;
        if (g.mode) {
          // measured from here, so nothing jumps as the slide takes over
          g.x = e.clientX;
          g.y = e.clientY;
        }
      }
      if (g.mode) live.current.drag(g, e.clientX - g.x, e.clientY - g.y);
    };
    // a held finger keeps the page still (a standalone player lets quick slides scroll its page)
    const tmove = (e) => {
      if (g && (g.held || g.mode) && e.cancelable) e.preventDefault();
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
      if (G.second && (G.moved || G.held)) lastTap = null;
      if (G.mode) {
        delete el.dataset.gesture;
        live.current.dragEnd(G, e.type === 'pointercancel');
        return;
      }
      if (G.holding || G.held) {
        endHold(G);
        return;
      }
      delete el.dataset.gesture;
      if (e.type === 'pointercancel') {
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
        live.current.toggle();
      }, 320);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('touchmove', tmove, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('touchmove', tmove);
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
      data-overlay={overlay || keysOpen || shareOpen || undefined}
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

      <div className="ac-mats" aria-hidden="true">
        <i data-s="t" />
        <i data-s="b" />
        <i data-s="l" />
        <i data-s="r" />
      </div>
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
          {corner}
          {shareInfo && (
            <button type="button" className="ac-link ac-share-open" onClick={() => setShareOpen(true)} aria-haspopup="dialog">
              Share
            </button>
          )}
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
          <QualityWord q={q} active={activeRendition} pri="3" />
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

      <Captions on={ccShowing} root={root} layout={below ? 'below' : ''} />
      {sb && <Filmstrip peek={peek} sb={sb} duration={d} />}
      {peek != null && !sb && (
        <span className="ac-bigtime" aria-hidden="true">
          {clock(peek)}
        </span>
      )}
      {flash && (
        <p className="ac-flash" data-side={flash.side} data-held={flash.held || flash.hold || undefined} key={flash.k} aria-hidden="true">
          <span>{flash.text}</span>
          {flash.level != null && (
            <span className="ac-meter">
              <span style={{ transform: `scaleX(${flash.level})` }} />
            </span>
          )}
        </p>
      )}
      {shareOpen && shareInfo && (
        <SharePanel
          share={shareInfo}
          t={t}
          onClose={() => {
            setShareOpen(false);
            root.current?.focus({ preventScroll: true });
          }}
        />
      )}
      {keysOpen && <KeysSheet feed={!!onNext} fine={fine} onClose={() => { setKeysOpen(false); root.current?.focus({ preventScroll: true }); }} />}

      <Hotkey keys="Space" action="togglePaused" disabled={overlay || keysOpen || shareOpen} />
      <Hotkey keys="k" action="togglePaused" disabled={overlay || keysOpen || shareOpen} />
      <Hotkey keys="m" action="toggleMuted" disabled={overlay || keysOpen || shareOpen} />
      <Hotkey keys="c" action="toggleSubtitles" disabled={overlay || keysOpen || shareOpen} />
      <Hotkey keys="i" action="togglePictureInPicture" disabled={overlay || keysOpen || shareOpen} />
      <Hotkey keys="ArrowLeft" action="seekStep" value={-10} disabled={overlay || keysOpen || shareOpen} />
      <Hotkey keys="ArrowRight" action="seekStep" value={10} disabled={overlay || keysOpen || shareOpen} />
      <Hotkey keys="j" action="seekStep" value={-10} disabled={overlay || keysOpen || shareOpen} />
      <Hotkey keys="l" action="seekStep" value={10} disabled={overlay || keysOpen || shareOpen} />
      <Hotkey keys="0-9" action="seekToPercent" disabled={overlay || keysOpen || shareOpen} />
      <Hotkey keys=">" action="speedUp" disabled={overlay || keysOpen || shareOpen} />
      <Hotkey keys="<" action="speedDown" disabled={overlay || keysOpen || shareOpen} />

      <div className="ac-sr">
        <StatusAnnouncer />
      </div>
    </Container>
  );
}

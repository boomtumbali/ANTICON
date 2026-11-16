import { useEffect, useRef, useState } from 'react';
import { Wordmark } from './Wordmark.jsx';
import { BlenderLink, MuxLink, VideoJsLink } from './credits.jsx';
import { FILMS, pad2 } from './films.js';

/**
 * Index: the ten films as a typographic list. Point at a title and its
 * poster appears beside the pointer (on a touch screen, beside the row);
 * pick one and the feed goes straight to it. Esc closes.
 */
export function IndexPage({ open, active, onClose, onPick, onHome }) {
  const ref = useRef(null);
  const peekEl = useRef(null);
  // which film's poster shows; where it sits is moved directly (no re-render per pointer move)
  const [peek, setPeek] = useState(null);
  const place = (x, y) => {
    if (peekEl.current) peekEl.current.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  };
  useEffect(() => {
    if (!open) {
      setPeek(null);
      return undefined;
    }
    const el = ref.current;
    requestAnimationFrame(() => el?.querySelector('[aria-current="true"]')?.focus({ preventScroll: true }));
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        const items = [...el.querySelectorAll('.ac-ix-row')];
        const i = items.indexOf(document.activeElement);
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);
  if (!open) return null;
  // the row under the pointer decides, read from the event itself, so a fast move never leaves a stale poster
  const onListMove = (e) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    const row = e.target.closest?.('.ac-ix-row');
    place(e.clientX, e.clientY);
    const i = row ? Number(row.dataset.i) : null;
    setPeek((p) => (p === i ? p : i));
  };
  return (
    <div className="ac-ix" role="dialog" aria-modal="true" aria-label="Index" ref={ref}>
      <div className="ac-ix-top">
        <span className="ac-mono">Index · {pad2(FILMS.length)} films</span>
        {onHome ? (
          <button type="button" className="ac-brand" onClick={onHome} aria-label="ANTICON, back to the start">
            <Wordmark center />
          </button>
        ) : (
          <span className="ac-brand" aria-hidden="true">
            <Wordmark center />
          </span>
        )}
        <button type="button" className="ac-link" onClick={onClose}>
          Close
        </button>
      </div>
      <ol className="ac-ix-list" onPointerMove={onListMove} onPointerLeave={() => setPeek(null)}>
        {FILMS.map((f, i) => (
          <li key={f.id}>
            <button
              type="button"
              className="ac-ix-row"
              data-i={i}
              aria-current={i === active || undefined}
              onClick={() => onPick(i)}
              onFocus={(e) => {
                // keyboard only: the poster sits beside the focused row
                if (!e.currentTarget.matches(':focus-visible')) return;
                const r = e.currentTarget.getBoundingClientRect();
                place(Math.min(r.left + r.width * 0.55, innerWidth - 300), r.top + r.height / 2);
                setPeek(i);
              }}
              onBlur={() => setPeek((p) => (p === i ? null : p))}
            >
              <span className="ac-ix-n">{pad2(f.n)}</span>
              <span className="ac-ix-t">{f.title}</span>
              <span className="ac-ix-y">{f.year}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="ac-ix-foot">
        ANTICON, a <VideoJsLink mark={false} /> player with no icons: only words and numbers. Ten <BlenderLink /> open movies (Creative Commons), hosted on <MuxLink mark={false} />.
        <span className="ac-ix-keys">
          Vibecoder <a className="ac-credit" href="https://contra.com/boomtumbali" target="_blank" rel="noreferrer">@boomtumbali</a> · ? for every key
        </span>
      </p>
      {/* all ten posters are loaded with the Index and stacked; the one you point at fades up, so changing is instant */}
      <div className="ac-ix-peek" ref={peekEl} data-on={peek != null || undefined} aria-hidden="true">
        {FILMS.map((f, i) => (
          <img key={f.id} src={f.poster} alt="" decoding="async" data-on={i === peek || undefined} />
        ))}
      </div>
    </div>
  );
}

/** Credits for the film in view: what it is, who made it, where it streams from. */
export function Credits({ film, open, onClose, onHome }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    requestAnimationFrame(() => ref.current?.querySelector('button')?.focus({ preventScroll: true }));
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="ac-ix ac-cr" role="dialog" aria-modal="true" aria-label={`Credits, ${film.title}`} ref={ref}>
      <div className="ac-ix-top">
        <span />
        {onHome ? (
          <button type="button" className="ac-brand" onClick={onHome} aria-label="ANTICON, back to the start">
            <Wordmark center />
          </button>
        ) : (
          <span className="ac-brand" aria-hidden="true">
            <Wordmark center />
          </span>
        )}
        <button type="button" className="ac-link" onClick={onClose}>
          Back to film
        </button>
      </div>
      <div className="ac-cr-body">
        <div className="ac-cr-text">
          <h2 className="ac-cr-title">
            <span>{film.title}</span>
            <span className="ac-year">({film.year})</span>
          </h2>
          {film.subtitle && <p className="ac-cr-sub">{film.subtitle}</p>}
          <dl className="ac-cr-list">
            <div>
              <dt>Built on</dt>
              <dd className="ac-cr-logo">
                <VideoJsLink height={12} />
              </dd>
            </div>
            <div>
              <dt>Stream</dt>
              <dd className="ac-cr-logo">
                <MuxLink height={12} />
              </dd>
            </div>
            <div>
              <dt>Studio</dt>
              <dd>
                <BlenderLink />
              </dd>
            </div>
            <div>
              <dt>Kind</dt>
              <dd>Open movie, made with Blender</dd>
            </div>
            <div>
              <dt>License</dt>
              <dd>Creative Commons</dd>
            </div>
            <div>
              <dt>Vibecoder</dt>
              <dd>
                <a className="ac-credit" href="https://contra.com/boomtumbali" target="_blank" rel="noreferrer">
                  @boomtumbali
                </a>
              </dd>
            </div>
            <div>
              <dt>Number</dt>
              <dd>
                {pad2(film.n)} of {pad2(FILMS.length)}
              </dd>
            </div>
          </dl>
        </div>
        <img className="ac-cr-poster" src={film.poster} alt={`${film.title} poster`} />
      </div>
    </div>
  );
}

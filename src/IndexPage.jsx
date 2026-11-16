import { useEffect, useRef, useState } from 'react';
import { FILMS, pad2 } from './films.js';

/**
 * Index: the ten films as a typographic list. Point at a title and its
 * poster appears beside the pointer (on a touch screen, beside the row);
 * pick one and the feed goes straight to it. Esc closes.
 */
export function IndexPage({ open, active, onClose, onPick }) {
  const ref = useRef(null);
  const [peek, setPeek] = useState(null); // { i, x, y }
  useEffect(() => {
    if (!open) return undefined;
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
  return (
    <div className="ac-ix" role="dialog" aria-modal="true" aria-label="Index" ref={ref} onPointerMove={(e) => peek && setPeek({ ...peek, x: e.clientX, y: e.clientY })}>
      <div className="ac-ix-top">
        <span className="ac-mono">Index · {pad2(FILMS.length)} films</span>
        <span className="ac-brand" aria-hidden="true">
          ANTICON
        </span>
        <button type="button" className="ac-link" onClick={onClose}>
          Close
        </button>
      </div>
      <ol className="ac-ix-list">
        {FILMS.map((f, i) => (
          <li key={f.id}>
            <button
              type="button"
              className="ac-ix-row"
              aria-current={i === active || undefined}
              onClick={() => onPick(i)}
              onPointerEnter={(e) => setPeek({ i, x: e.clientX, y: e.clientY })}
              onPointerLeave={() => setPeek(null)}
              onFocus={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setPeek({ i, x: r.right - 40, y: r.top + r.height / 2, focus: true });
              }}
              onBlur={() => setPeek(null)}
            >
              <span className="ac-ix-n">{pad2(f.n)}</span>
              <span className="ac-ix-t">{f.title}</span>
              <span className="ac-ix-y">{f.year}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="ac-ix-foot">
        ANTICON, a Video.js 10 player with no icons: only words and numbers. Ten Blender Studio open movies (Creative Commons), hosted on Mux.
        <span className="ac-ix-keys">
          Player <a className="ac-credit" href="https://contra.com/boomtumbali" target="_blank" rel="noreferrer">Boom Tumbali</a> · ? for every key
        </span>
      </p>
      {peek && <img className="ac-ix-poster" src={FILMS[peek.i].poster} alt="" aria-hidden="true" style={{ left: peek.x, top: peek.y }} />}
    </div>
  );
}

/** Credits for the film in view: what it is, who made it, where it streams from. */
export function Credits({ film, open, onClose }) {
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
        <span className="ac-brand" aria-hidden="true">
          ANTICON
        </span>
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
              <dt>Studio</dt>
              <dd>{film.studio}</dd>
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
              <dt>Stream</dt>
              <dd>Mux · {film.playbackId.slice(0, 10)}…</dd>
            </div>
            <div>
              <dt>Player</dt>
              <dd>
                <a className="ac-credit" href="https://contra.com/boomtumbali" target="_blank" rel="noreferrer">
                  Boom Tumbali
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

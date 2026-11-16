/**
 * The wordmark: ΛNTICON. The A without its crossbar (the brand font's own Λ,
 * which is its A, bar removed), and a hairline through ICON: the icon,
 * switched off, the way the player switches anything off.
 *
 * `center`: the I sits exactly on the middle of the mark's box, so a mark
 * centred on the screen puts the I on the screen's centre line (where the
 * scrub strip's line runs). Otherwise the letters simply flow.
 */
export function Wordmark({ center = false, className = '' }) {
  return (
    <span className={`wm${center ? ' wm--center' : ''} ${className}`.trim()} role="img" aria-label="ANTICON">
      <span className="wm-l" aria-hidden="true">
        ΛNT
      </span>
      <span className="wm-i" aria-hidden="true">
        I
      </span>
      <span className="wm-r" aria-hidden="true">
        CON
      </span>
    </span>
  );
}

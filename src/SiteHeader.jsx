/*
 * The site's header, the same on every page: the mark on the left, the pages and the Light word on the right
 * (on a portrait screen, the pages on a second line). The page you are on drops out of the list.
 */
import { useLayoutEffect, useRef } from 'react';
import { Wordmark } from './Wordmark.jsx';
import { ThemeWord } from './theme.jsx';

export const REPO = 'https://github.com/boomtumbali/anticon';
const PAGES = [
  ['feed', 'Feed', '/'],
  ['test', 'Test', '/player/'],
  ['embed', 'Embed', '/embed/'],
  ['source', 'Source', REPO],
];

export function SiteHeader({ page, className = '' }) {
  // its height, as --site-head, so a page can fill exactly the rest of the first screen
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const set = () => document.documentElement.style.setProperty('--site-head', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <header className={`site-top ${className}`.trim()} ref={ref}>
      <a className="site-brand" href="/" aria-label="ANTICON, the start">
        <Wordmark />
      </a>
      <nav className="site-nav" aria-label="Pages">
        {PAGES.filter(([id]) => id !== page).map(([id, name, href]) =>
          id === 'source' ? (
            <a key={id} href={href} target="_blank" rel="noreferrer">
              {name}
            </a>
          ) : (
            <a key={id} href={href}>
              {name}
            </a>
          ),
        )}
        <ThemeWord />
      </nav>
    </header>
  );
}

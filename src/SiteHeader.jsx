/*
 * The site's header, the same on every page: the mark on the left, the pages and the Light word on the right
 * (on a portrait screen, the pages on a second line). The page you are on drops out of the list.
 */
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
  return (
    <header className={`site-top ${className}`.trim()}>
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

// Writes public/film/<id>/index.html for each film: a tiny page that link
// previews read (its own title, description and picture), and that sends a
// person straight on to the feed at that film (and the time, with ?t=).
// Run after changing the films: npm run film-pages
import { mkdirSync, writeFileSync } from 'node:fs';
import { FILMS } from '../src/films.js';

const SITE = 'https://anticon-boom.vercel.app';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

for (const f of FILMS) {
  const name = f.subtitle ? `${f.title}: ${f.subtitle}` : f.title;
  const title = `${name} (${f.year}) · ANTICON`;
  const desc = `Watch ${name}, a Blender Studio open movie, on ANTICON: a video player with no icons, by @boomtumbali.`;
  const url = `${SITE}/film/${f.id}`;
  const img = `${SITE}/og/${f.id}.jpg`;
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="video.movie" />
    <meta property="og:site_name" content="ANTICON" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${esc(`${name}, ${f.year}, on ANTICON by @boomtumbali`)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${img}" />
    <link rel="icon" href="/favicon.svg?v=3" type="image/svg+xml" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>html,body{margin:0;height:100%;background:#000;color:#f3f1ec;font:300 18px/1.4 system-ui,sans-serif}a{color:inherit}body{display:grid;place-content:center}</style>
    <script>location.replace('/' + location.search + '#${f.id}');</script>
  </head>
  <body>
    <a href="/#${f.id}">${esc(name)}, on ANTICON</a>
  </body>
</html>
`;
  mkdirSync(new URL(`../public/film/${f.id}/`, import.meta.url), { recursive: true });
  writeFileSync(new URL(`../public/film/${f.id}/index.html`, import.meta.url), html);
}
console.log(`wrote ${FILMS.length} film pages`);

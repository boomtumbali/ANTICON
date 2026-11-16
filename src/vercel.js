import { inject, pageview } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { LOCAL } from './films.js';

/*
 * Vercel Web Analytics (visitors, page views, referrers, countries) and
 * Speed Insights (real-user loading scores), on the deployed site only:
 * not in `npm run dev` and not in ?local test mode. The feed writes the
 * film into the URL hash as you scroll; that is not a new page, so each
 * page load counts once, under its path without the hash. Playback itself
 * (startup, rebuffering, watch time) is Mux Data's job, in the feed.
 */
if (import.meta.env.PROD && !LOCAL) {
  const path = location.pathname.replace(/index\.html$/, '').replace(/(.)\/$/, '$1') || '/';
  inject({ mode: 'production', disableAutoTrack: true, framework: 'vite' });
  pageview({ route: path, path });
  injectSpeedInsights({ route: path, softNavs: false, framework: 'vite' });
}

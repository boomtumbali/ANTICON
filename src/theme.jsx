import { useEffect, useState } from 'react';

/*
 * Light or dark page. One choice, kept in this browser and shared by every
 * page (Feed, Test, Embed) once made. Until then each page has its own: the
 * Feed opens dark (a cinema), Test and Embed open light (the player's edges
 * show against the page). The pages set it before they paint (a line in each
 * page's <head>, which also records the page's own default), so no flash.
 * The player itself stays dark: it is a picture frame.
 */
const KEY = 'anticon-theme';
const pageDefault = () => (document.documentElement.dataset.themeDefault === 'light' ? 'light' : 'dark');
export const getTheme = () => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : pageDefault();
  } catch {
    return pageDefault();
  }
};
export function setTheme(t) {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* private window: this page only */
  }
  document.documentElement.dataset.theme = t;
  window.dispatchEvent(new CustomEvent('anticon:theme', { detail: t }));
}
export function useTheme() {
  const [t, setT] = useState(getTheme);
  useEffect(() => {
    const on = (e) => setT(e.detail);
    // another tab changed it
    const st = (e) => {
      if (e.key !== KEY) return;
      const v = getTheme();
      document.documentElement.dataset.theme = v;
      setT(v);
    };
    window.addEventListener('anticon:theme', on);
    window.addEventListener('storage', st);
    return () => {
      window.removeEventListener('anticon:theme', on);
      window.removeEventListener('storage', st);
    };
  }, []);
  return [t, setTheme];
}

/** The switch, as a word: "Light", with a line through it while the page is dark. */
export function ThemeWord({ className = '' }) {
  const [t, set] = useTheme();
  const light = t === 'light';
  return (
    <button
      type="button"
      className={`theme-word ${className}`.trim()}
      aria-pressed={light}
      data-off={!light || undefined}
      onClick={() => set(light ? 'dark' : 'light')}
      title={light ? 'Light page. Click for dark' : 'Dark page. Click for light'}
    >
      <span>Light</span>
    </button>
  );
}

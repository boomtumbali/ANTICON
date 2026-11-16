# ANTICON

**A video player without icons.** Every control is a word or a number, set in thin type. A control that can be on or off is a word: when it's off, a hairline runs through its middle; click it again and the line lifts. Progress is a single hairline with no knob. The words sit on the edges of the frame and run along each edge's own axis, so the player reads like a typographic poster rather than a toolbar.

Built on **Video.js 10** (`@videojs/react`) for the Video.js v10 Skins Challenge.

Player: **Boom Tumbali** · [contra.com/boomtumbali](https://contra.com/boomtumbali)

---

## Pages

| Path | What it is |
| --- | --- |
| `/` | **The feed.** Ten Blender Studio films, one per screen, under one player that stays put. Scroll (mouse wheel or trackpad, one film per turn), swipe on a phone, or use ↑ ↓ / N P / Page Up / Page Down. Index and Credits open from the corners. |
| `/player/` | **The player lab.** One player put through the screens it will meet (phone upright and sideways, tablet, laptop, desktop, TV, a 16:9 embed, or the free stage) and the pictures that are hardest to read over (white, paper, black, bars, half and half), plus all ten films. A live readout shows the box size, how the words are laid out, how many are resting, and which ink each zone chose. |
| `/embed/` | **The player on a page.** The standalone player at 16:9, 9:16, 21:9 and 4:3, a thumbnail-width player, and the snippet to use it. |

## The layout

```
 Title                         ANTICON                     02:41:07 UTC  Keys
 2021 · Blender Studio

 L                                                                       S
 o                                                                       o
 o                                                                       u
 p                                                                       n
                                                                         d
 1×                                                                     64
 +10                                                                   Fill
 −10                                                                    PiP
 Pause                                                                 Full

 00:41 ─────────────────────────────────────────────────────────────── 07:05
 Scroll for next  Coffee Run
```

- **Top left:** the title, with year and studio in mono below it. In the feed the title opens the film's credits.
- **Top centre:** the brand (the feed only).
- **Top right:** a slot for the host (a clock by default; the feed puts its film count, `09 / 10`, and Index there), plus **Keys** on a computer or **Touch** on a phone, which opens the full shortcut sheet.
- **Left edge, reading upward:** Play / Pause / Replay, −10, +10, playback rate, CC (only when the film has captions), Loop.
- **Right edge, reading downward:** Sound with its volume number (drag it, scroll it, or use the arrow keys on it), Fill, PiP, Cast, Full.
- **Bottom:** elapsed time, the hairline, total time. While you scrub or hover the line, the time you're aiming at shows large and thin in the middle of the picture. Below the line is a slot for the host (the feed shows the next film).
- **Cursor:** over the picture the pointer becomes the word *Play* or *Pause*, with the time beneath it, so a click always says what it will do.

### Adaptive, by the player's own box

The skin uses CSS container queries on its own box, not the window, so the same player is right in a narrow column, a full-width hero, an upright phone or a TV.

| The box | What changes |
| --- | --- |
| 600 px tall or more | The words run up the left edge and down the right edge |
| Under 600 px tall | Both edges lie along the bottom instead, mirrored left and right |
| Short and under 640 px wide | Rate, CC, Loop, PiP and Cast rest (keys still work) |
| Under 440 px wide | ±10, Fill and the volume number rest too |
| Narrow and tall | The title steps down a size |
| Under 300 / 200 px tall | Thumbnail rules: only what fits is shown |

Nothing overlaps and nothing leaves the frame at any of these sizes (tested at desktop, laptop, TV, tablet, phone upright and sideways, iPhone SE, and every embed size on `/embed/`).

### Ink that follows the picture

Thin white words disappear on a bright sky. ANTICON reads the picture about three times a second: it draws the current frame into a 96 px canvas with the same fit as the screen, then measures the brightness under each zone where words actually sit (title, brand, corner, left edge, right edge, bottom, centre). Each zone picks its own ink:

- **Dark picture:** light ink with a soft dark halo.
- **Bright picture:** dark ink with a soft light halo, and the top and bottom veils turn white instead of black.
- **Split zone** (half on a black letterbox band, half on a white sky): light ink held by a tight dark halo, which reads over both.

Hysteresis (bright above 0.62, back to dark below 0.50) stops the ink flickering on a picture near the threshold. The veils start where the picture starts, so a letterbox band never turns grey. If a frame cannot be read (a stream without CORS), the skin keeps light ink and dark veils, which is the safe default for film.

`tone="dark"` or `tone="light"` fixes the ink instead; the lab's **Ink** choice shows all three. High-contrast and reduced-motion system settings are respected.

## Keyboard

Focus stays on the player, so keys work straight away and Space never re-presses the last clicked word.

| Keys | Action |
| --- | --- |
| Space, K | Play or pause |
| ← → or J L | 10 seconds back or forward |
| Shift ← → | 30 seconds |
| , . | One frame (pauses) |
| Home, End | The start, the end |
| 0 – 9 | Jump to 0 % … 90 % |
| ↑ ↓ | Volume (standalone) · previous or next film (feed) |
| Shift ↑ ↓ | Volume (feed) |
| N P, Page Up / Down | Next or previous film (feed) |
| M | Sound on or off |
| C | Captions |
| < > | Slower, faster |
| F, double-click | Full screen |
| I | Picture in picture |
| ? | Keys and touch sheet |
| Esc | Close the sheet, Index or Credits |

Every jump flashes the result large and thin in the centre (`+10`, `1.5×`, `Sound 40`) and is announced to screen readers.

## Touch

| Gesture | Action |
| --- | --- |
| Tap | Play or pause |
| Double-tap a side | 10 seconds back or forward |
| Keep tapping | 10 more seconds each time |
| Double-tap the middle | Fill or fit |
| Hold | Twice the speed while you hold |
| Slide sideways | Scrub, up to three minutes across the screen |
| Pinch | Out to fill, in to fit |
| Swipe up or down | Next or previous film (feed) |

Vertical swipes are left to the page (`touch-action: pan-y`), so the feed scrolls natively and the player never fights the page it sits in.

## Use it

```jsx
import { AnticonPlayer } from './player/AnticonPlayer.jsx';
import '@fontsource-variable/inter-tight';
import '@fontsource-variable/geist-mono';
import './anticon.css';

<AnticonPlayer
  playbackId="Mux playback ID"   // or src="film.mp4"
  title="Sprite Fright"
  meta="2021 · Blender Studio"
  aspect="16 / 9"                // any ratio; null to size it yourself with style
/>
```

| Prop | Default | |
| --- | --- | --- |
| `playbackId` / `src` | | A Mux playback ID, or any MP4 or HLS URL |
| `title`, `meta` | | Top left |
| `poster` | Mux thumbnail | Shown until the film runs |
| `aspect` | `'16 / 9'` | `null` to size it with `style` |
| `autoPlay` | `false` | Starts muted, as browsers require |
| `defaultFill` | `false` | Start filled (cover) rather than fitted |
| `corner` | a clock | Anything for the top right |
| `tone` | `'adapt'` | `'dark'` or `'light'` to fix the ink |

For a host that needs more (the feed), `AnticonSkin` in `src/player/Skin.jsx` takes the media as children plus `brand`, `below`, `onTitle`, `onNext` / `onPrev`, `onFullscreen`, `loop` / `onLoop` and `overlay`.

## What it uses from Video.js 10 and Mux

- `createPlayer({ features: videoFeatures })` with the store for play state, time, buffer, volume, rate, captions, PiP, remote playback (Cast / AirPlay), full screen and controls visibility.
- `Gesture`, `Hotkey` and `StatusAnnouncer` from `@videojs/react`.
- `MuxVideo` (hls.js through MSE, with a higher starting bandwidth estimate so films open sharp) and `MuxData` for playback analytics in the feed.
- Mux thumbnails as stills and the ambient blur behind fitted films.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/
```

Deploy on Vercel as a Vite project; `vercel.json` maps `/player` and `/embed` to their pages.

## The films

All by Blender Studio, released under Creative Commons, streamed through Mux.

| # | Film | Year |
| --- | --- | --- |
| 01 | Singularity | 2026 |
| 02 | Sintel | 2010 |
| 03 | Hero | 2018 |
| 04 | Elephants Dream | 2006 |
| 05 | Agent 327: Operation Barbershop | 2017 |
| 06 | Tears of Steel | 2012 |
| 07 | Charge | 2022 |
| 08 | Spring | 2019 |
| 09 | Sprite Fright | 2021 |
| 10 | Coffee Run | 2020 |

## Type

Inter Tight (variable, thin weights) for words; Geist Mono for numbers and labels. Both are bundled through Fontsource, so nothing loads from a font CDN.

## Credits

Player: **Boom Tumbali** · [contra.com/boomtumbali](https://contra.com/boomtumbali)

Built on Video.js 10. Films by Blender Studio, Creative Commons. Streams hosted on Mux. The Video.js logo belongs to the Video.js project.

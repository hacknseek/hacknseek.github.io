# HackNSeek

Small tools. More flow. A free, offline-first toolbox for music practice, focus,
and a little downtime. Plain HTML, CSS, and JavaScript; no framework, build step,
accounts, analytics, or external runtime dependencies. Installable as a PWA and
hosted on GitHub Pages.

## The collection

- **Metronome** — 30–260 BPM, six time signatures, five synthesized sounds,
  volume control, tempo presets, and tap input. `Space` plays/pauses, `↑` / `↓`
  adjust by 5 BPM, `R` resets, and `Esc` stops. Settings are saved locally.
- **Tuner** — Chromatic microphone tuner with cents, input level, and pitch
  history. A4 references: 432, 440, 442, and 444 Hz. Audio stays on the device;
  the microphone is released when stopped or when leaving the tool.
- **Pitch Trace** — A live microphone pitch graph for singers and instruments.
  Detected notes enter on the right and travel left across a 5–30 second time
  window. Natural-note rows span C2–B6, octaves have distinct colors, and the
  display can be transposed by ±12 semitones. Switch to the one-octave detail
  view to fold every octave into a single span with the selected key's tonic at
  the bottom, chromatic guide lines, and highlighted ±5-cent in-tune bands.
  Choose any of the 12 major keys to highlight its seven scale tones and show
  the detected note's scale degree. A4 reference and sensitivity are
  configurable; audio remains on the device.
- **Timer** — Countdown and configurable work/rest intervals, including Tabata,
  HIIT, EMOM, and boxing presets. Pause/resume, audio alerts, and vibration where
  supported. Zero-second rest skips directly to the next round.
- **Tap Tempo** — Tap or press `Space` to measure a rhythm. A trimmed mean of the
  latest 32 taps stabilizes the reading. Pause for more than two seconds to start
  a new reading. Send the result to the metronome (within its 30–260 BPM range).
- **Hexic** — Rotate connected groups of three tiles to form clusters, flowers,
  stars, and pearls. Includes hints, keyboard controls, and a local best score.
- **Kelly Lab** — Explore Kelly stake sizing, long-run geometric growth, and 100
  independent 100-round bankroll simulations. Runs locally and works offline.

The home collection filters tools by Music, Focus, and Play. Each tool has direct
navigation to the others. The visual system uses warm paper tones, restrained
color, and locally rendered SVG instrument illustrations. It supports small
screens, keyboard focus, and reduced motion.

## Local development

Serve the repository root with any static server:

```sh
python -m http.server 4173 --bind 127.0.0.1
```

Open [the local preview](http://127.0.0.1:4173). Microphone access requires HTTPS
or localhost. The app can be installed through a supported browser; otherwise
the install button explains the available options.

The service worker precaches the entire collection on the first successful
load. Reload once before testing offline mode. While iterating on cached files,
use the browser's service-worker bypass option or unregister the worker in
DevTools. The footer version button checks for published updates and reports
when the network is unavailable.

## Browser checks

The optional regression suite requires Node.js, Playwright, and Microsoft Edge:

```sh
npm install --no-save --package-lock=false playwright
node tests/browser-smoke.cjs
```

Start the static server first. `TEST_URL` overrides the preview URL,
`BROWSER_CHANNEL` selects another installed Chromium browser (for example
`chrome`), `PLAYWRIGHT_MODULE` points to an existing Playwright installation,
and `SCREENSHOTS` sets an optional output directory. These are test dependencies
only; the deployed app has none.

The checks cover category filters, installation help, tempo controls and voices,
local persistence, timer modes and pause/resume, tap-to-metronome transfer,
synthetic microphone pitch detection and cleanup, Pitch Trace transposition,
Hexic moves, every route at
320/390/768/1440 px, and a full offline reload. Synthetic audio verifies the
pitch algorithm; a physical microphone and real-device installation still need
manual checks on the target browser.

## Structure

- `index.html` — App shell and PWA metadata.
- `css/styles.css` — Shared responsive design system and tool layouts.
- `js/main.js` — App registry, hash router, collection filters, installation,
  offline status, and service-worker update handling.
- `js/dom.js` — DOM helpers, local storage, toast, and audio utilities.
- `js/pitch.js` — Shared autocorrelation and pitch-to-note helpers.
- `js/icons.js` / `js/artwork.js` — Local SVG icons and instrument illustrations.
- `js/apps/<id>.js` — Each tool exports a render function accepting
  `{ main, onCleanup }`; cleanup releases listeners, timers, and audio resources.
- `sw.js` — Versioned offline shell. Navigation is network-first and assets are
  cache-first. Activation removes older HackNSeek caches only.
- `tests/browser-smoke.cjs` — Optional end-to-end regression checks.

Legacy `/apps/metronome/` and `/apps/tuner/` bookmarks redirect to the hash routes.

## Publishing and extending

GitHub Pages serves the root of `hacknseek/hacknseek.github.io` at
[HackNSeek](https://hacknseek.github.io/). Publish by pushing to `main`.

When releasing changes, increment the cache version in `sw.js` and keep the
module URL versions in `index.html`, `js/main.js`, and the service-worker shell
in sync. To add a tool, register it in `APPS`, add its illustration and styles,
precache its module, and optionally add a manifest shortcut.

## License

MIT.

# HackNSeek Tools

A small, offline-first collection of web apps for musicians and tinkerers. Hosted
on GitHub Pages, installable as a PWA, no build step.

## Apps

- **Metronome** — Web-Audio scheduled click track. 30–260 BPM, time signatures
  from 2/4 to 7/8, 5 sound choices (click, beep, wood, cowbell, snare), tap
  tempo, and keyboard shortcuts (`Space` play, `↑/↓` ±5 BPM, `R` reset).
- **Tuner** — Chromatic tuner using the microphone. ACF + parabolic
  interpolation pitch detection, A4 = 432/440/442/444 Hz, sensitivity slider,
  pitch history graph.
- **Timer** — Countdown timer plus HIIT / Tabata / EMOM interval presets.
  Audio alarm and vibration at the end of each phase; pause/resume keeps your
  place in a session.
- **Tap Tempo** — Press `Space` (or the big button) along with a song to read
  out its BPM. Trimmed-mean for stability.

## Architecture

- Single page app. `index.html` boots a tiny hash router from `js/main.js`.
- No framework, no build step — plain ES modules:
  - `js/dom.js` — DOM helpers, localStorage wrapper, toast, misc utilities
  - `js/icons.js` — inline SVG icon strings
  - `js/main.js` — app registry, hash router, hub page, service-worker hookup
  - `js/apps/<id>.js` — one module per tool, each exports `render({ main, onCleanup })`
- Shared design system in `css/styles.css` (dark + glass, mobile-first).
- `sw.js` precaches the shell: network-first for navigations, cache-first for
  assets — full offline support once loaded.
- Legacy `/apps/<name>/` URLs redirect to the new `#<name>` routes, so old
  bookmarks keep working.

## Local development

The only thing you need is a static file server with relative-path support
(GitHub Pages is fine; `python -m http.server` works too). No build step.

```
# from the repo root
python -m http.server 8000
# then open http://localhost:8000
```

## Deploying

Push to `main` on the `hacknseek/hacknseek.github.io` repo. GitHub Pages
serves the project root, so the live URL is `https://hacknseek.github.io/`.

## Adding an app

1. Create `js/apps/<id>.js` exporting `render({ main, onCleanup })`.
2. Register it in `APPS` in `js/main.js` (id, name, desc, icon).
3. Use `onCleanup(fn)` for teardown so event listeners and audio contexts die
   when the user navigates away.
4. Optionally add `apps/<id>/index.html` redirecting to `#<id>`, plus a
   shortcut entry in `manifest.json`.

## License

MIT.

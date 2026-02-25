# HackNSeek Web Apps

A collection of useful progressive web apps for musicians and more, with offline support.

## Apps

### 🎵 Metronome
Keep the beat with adjustable BPM (40-200) and multiple time signatures (4/4, 3/4, 2/4, 6/8).

**Features:**
- Accurate timing with visual and audio feedback
- Tempo presets (Largo, Andante, Moderato, Allegro, Presto)
- Keyboard shortcuts (Space to play/pause, arrows to adjust BPM)
- Works offline

### ⏱️ Timer (Coming Soon)
Countdown and interval timer

### 🎹 Tuner (Coming Soon)
Instrument tuner with chromatic support

### 📐 Tap Tempo (Coming Soon)
BPM tap tempo detector

## Usage

1. Open `index.html` in a web browser
2. Click on an app card to launch it
3. For full PWA features (offline support, install), serve from a web server

## Installation

### As a PWA

1. Open the app in a supported browser (Chrome, Edge, Safari, Firefox)
2. Look for the "Install" button in the address bar or menu
3. Click "Install" to add to your home screen/desktop

### Manual Setup

1. Clone or download this repository
2. Serve the files from a web server (required for PWA features)
3. Open in your browser

## Development

To add a new app:

1. Create a new folder in `apps/`
2. Add your app's HTML, CSS, and JS files
3. Add an app card to `index.html`
4. Update `sw.js` to cache the new files

## File Structure

```
hacknseek/
├── index.html          # App hub / landing page
├── styles.css          # Shared CSS styling
├── script.js           # Hub page JavaScript
├── manifest.json       # PWA manifest
├── sw.js              # Service worker
├── icons/             # App icons
└── apps/
    └── metronome/     # Metronome app
        ├── index.html
        └── script.js
```

## License

MIT License

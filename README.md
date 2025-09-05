# Metronome PWA

A progressive web app metronome for musicians with offline support and modern UI.

## Features

- 🎵 **Accurate Metronome**: BPM range from 40-200 with precise timing
- 🎼 **Multiple Time Signatures**: 4/4, 3/4, 2/4, and 6/8 time signatures
- 🔊 **Audio Feedback**: High-quality tick and accent sounds
- 👁️ **Visual Indicators**: Animated beat indicator and dot visualization
- 📱 **PWA Support**: Installable on mobile and desktop devices
- 🌐 **Offline Functionality**: Works without internet connection
- ⌨️ **Keyboard Shortcuts**: Space to play/pause, arrows to adjust BPM
- 🎨 **Modern UI**: Responsive design with glassmorphism effects

## Usage

1. Open `index.html` in a web browser
2. Adjust BPM using the slider or +/- buttons
3. Select your desired time signature
4. Click the play button or press spacebar to start
5. Tap anywhere on the screen to toggle playback

### Keyboard Shortcuts

- **Space**: Play/Pause metronome
- **↑/↓**: Increase/Decrease BPM by 5
- **Escape**: Stop metronome

## Installation

### As a PWA

1. Open the app in a supported browser (Chrome, Edge, Safari, Firefox)
2. Look for the "Install" button in the address bar or menu
3. Click "Install" to add to your home screen/desktop

### Manual Setup

1. Clone or download this repository
2. Serve the files from a web server (required for PWA features)
3. Open in your browser

## Browser Support

- Chrome 68+
- Firefox 60+
- Safari 11.1+
- Edge 79+

## Development

To modify or extend the metronome:

1. Edit `script.js` for functionality changes
2. Edit `styles.css` for visual modifications
3. Update `manifest.json` for PWA configuration
4. Modify `sw.js` for service worker behavior

## File Structure

```
metronome-pwa/
├── index.html          # Main HTML file
├── styles.css          # CSS styling
├── script.js           # JavaScript functionality
├── manifest.json       # PWA manifest
├── sw.js              # Service worker
├── icons/             # App icons (various sizes)
└── README.md          # This file
```

## License

This project is open source and available under the MIT License.

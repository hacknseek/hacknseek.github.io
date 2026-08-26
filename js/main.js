import { el } from './dom.js';
import { icons } from './icons.js';
import { Metronome } from './apps/metronome.js';
import { Tuner } from './apps/tuner.js';
import { TimerApp } from './apps/timer.js';
import { TapTempo } from './apps/tap-tempo.js';

const GITHUB_URL = 'https://github.com/hacknseek/hacknseek.github.io';

const APPS = [
  { id: 'metronome', name: 'Metronome', desc: 'Click track for practice: 30\u2013260 BPM, time signatures, five sounds and tap tempo.', icon: icons.metro, render: Metronome },
  { id: 'tuner', name: 'Tuner', desc: 'Chromatic tuner using your microphone, with cents readout and pitch history.', icon: icons.tuner, render: Tuner },
  { id: 'timer', name: 'Timer', desc: 'Countdown plus HIIT, Tabata and EMOM interval presets with audio alerts.', icon: icons.timer, render: TimerApp },
  { id: 'tap-tempo', name: 'Tap Tempo', desc: "Find a song's BPM by tapping along with the beat.", icon: icons.tap, render: TapTempo },
];

const root = document.getElementById('app');

let cleanups = [];
const onCleanup = (fn) => cleanups.push(fn);
function runCleanups() {
  while (cleanups.length) {
    try { cleanups.pop()(); } catch {}
  }
}

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  if (btn) btn.hidden = false;
});

function topbar() {
  return el('div', { className: 'topbar' }, [
    el('a', { className: 'brand', href: '#/' }, [
      el('span', { className: 'logo', 'aria-hidden': 'true' }),
      el('span', {}, [
        document.createTextNode('HackNSeek'),
        el('small', {}, 'A pocket toolbox'),
      ]),
    ]),
    el('div', { className: 'row' }, [
      el('a', { className: 'pill', href: GITHUB_URL, target: '_blank', rel: 'noopener' }, 'Source'),
    ]),
  ]);
}

function hub(main) {
  const hero = el('section', { className: 'hero' }, [
    el('h1', {}, 'Tools for makers, in your pocket.'),
    el('p', {}, 'A tiny, offline-first collection of web apps. Install it like a native app \u2014 no app store.'),
    el('div', { className: 'row' }, [
      el('a', { className: 'btn primary', href: '#metronome' }, 'Open the toolbox'),
      el('button', { className: 'btn ghost', id: 'installBtn', hidden: true }, 'Install app'),
    ]),
  ]);

  const grid = el('section', { className: 'apps' });
  for (const a of APPS) {
    grid.append(
      el('a', { className: 'card', href: '#' + a.id }, [
        el('div', { className: 'icon', 'aria-hidden': 'true', innerHTML: a.icon }),
        el('h3', {}, a.name),
        el('p', {}, a.desc),
        el('span', { className: 'tag' }, 'Ready'),
      ])
    );
  }

  const foot = el('footer', { className: 'foot' }, [
    'Open source. Works offline. ',
    el('a', { href: GITHUB_URL, target: '_blank', rel: 'noopener' }, 'View on GitHub'),
    '.',
  ]);

  main.append(hero, grid, foot);

  const installBtn = main.querySelector('#installBtn');
  if (deferredPrompt) installBtn.hidden = false;
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch {}
    deferredPrompt = null;
    installBtn.hidden = true;
  });
}

function parseRoute() {
  return (location.hash || '').replace(/^#\/?/, '').toLowerCase().split('/').filter(Boolean);
}

function render() {
  runCleanups();
  const [id] = parseRoute();
  root.replaceChildren(topbar());
  const main = el('main', { className: 'col' });
  root.append(main);
  const app = APPS.find((a) => a.id === id);
  if (!app) {
    if (id) { location.replace('#/'); return; }
    hub(main);
    return;
  }
  app.render({ main, onCleanup });
}

window.addEventListener('hashchange', render);
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        reg.update().catch(() => {});
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (hadController && !window.__hnsReloading) {
            window.__hnsReloading = true;
            location.reload();
          }
        });
      })
      .catch(() => {});
  });
}

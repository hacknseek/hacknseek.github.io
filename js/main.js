import { el, toast } from './dom.js';
import { icons } from './icons.js';
import { Metronome } from './apps/metronome.js';
import { Tuner } from './apps/tuner.js';
import { TimerApp } from './apps/timer.js';
import { TapTempo } from './apps/tap-tempo.js';
import { Hexic } from './apps/hexic.js?v=1.0.8';

const GITHUB_URL = 'https://github.com/hacknseek/hacknseek.github.io';
const APP_VERSION = '1.0.8';

const APPS = [
  { id: 'metronome', name: 'Metronome', desc: 'Click track for practice: 30\u2013260 BPM, time signatures, five sounds and tap tempo.', icon: icons.metro, render: Metronome },
  { id: 'tuner', name: 'Tuner', desc: 'Chromatic tuner using your microphone, with cents readout and pitch history.', icon: icons.tuner, render: Tuner },
  { id: 'timer', name: 'Timer', desc: 'Countdown plus HIIT, Tabata and EMOM interval presets with audio alerts.', icon: icons.timer, render: TimerApp },
  { id: 'tap-tempo', name: 'Tap Tempo', desc: "Find a song's BPM by tapping along with the beat.", icon: icons.tap, render: TapTempo },
  { id: 'hexic', name: 'Hexic', desc: 'Classic hex-puzzle: rotate groups of three to make clusters, flowers, stars and pearls.', icon: icons.hex, render: Hexic },
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
        el('small', {}, `A pocket toolbox · v${APP_VERSION}`),
      ]),
    ]),
    el('div', { className: 'row' }, [
      el('button', {
        className: 'icon-btn',
        'aria-label': 'Check for updates',
        title: 'Check for updates',
        innerHTML: icons.refresh,
        onclick: () => checkForUpdate(true),
      }),
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

let checkingUpdate = false;

async function checkForUpdate(manual = false) {
  if (!('serviceWorker' in navigator)) {
    if (manual) toast('Updates are not supported in this browser.');
    return;
  }
  if (checkingUpdate) {
    if (manual) toast('Already checking\u2026');
    return;
  }
  checkingUpdate = true;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      if (manual) toast('Offline cache is not active yet.');
      return;
    }
    let found = false;
    const onUpdateFound = () => { found = true; };
    reg.addEventListener('updatefound', onUpdateFound);
    try { await reg.update(); } catch {}
    reg.removeEventListener('updatefound', onUpdateFound);

    if (!found) {
      if (manual) toast('You are on the latest version.');
      return;
    }

    const worker = reg.installing || reg.waiting;
    toast('Update found \u2014 applying\u2026', 4000);
    if (worker) {
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated' && !window.__hnsReloading) {
          window.__hnsReloading = true;
          location.reload();
        }
      });
    } else if (!window.__hnsReloading) {
      window.__hnsReloading = true;
      setTimeout(() => location.reload(), 1200);
    }
  } finally {
    checkingUpdate = false;
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker
      .register('./sw.js')
      .then(() => checkForUpdate(false))
      .catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !window.__hnsReloading) {
        window.__hnsReloading = true;
        location.reload();
      }
    });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate(false);
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) checkForUpdate(false);
  });
}

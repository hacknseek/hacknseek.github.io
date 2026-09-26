import { el, toast } from './dom.js';
import { icons } from './icons.js';
import { artwork } from './artwork.js';
import { Metronome } from './apps/metronome.js';
import { Tuner } from './apps/tuner.js';
import { PitchTrace } from './apps/pitch-trace.js';
import { TimerApp } from './apps/timer.js';
import { TapTempo } from './apps/tap-tempo.js';
import { Hexic } from './apps/hexic.js?v=2.0.1';

const GITHUB_URL = 'https://github.com/hacknseek/hacknseek.github.io';
const APP_VERSION = '2.1.1';
const APPS = [
  { id: 'metronome', name: 'Metronome', tagline: 'Make every beat count.', desc: 'A steady pulse for finding your rhythm. Set the pace, pick a sound, and settle into practice.', category: 'music', meta: '30–260 BPM', icon: icons.metro, render: Metronome },
  { id: 'tuner', name: 'Tuner', tagline: 'A little more in tune.', desc: 'Find the right note with a precise chromatic tuner.', category: 'music', meta: 'CHROMATIC · MIC INPUT', icon: icons.tuner, render: Tuner },
  { id: 'pitch-trace', name: 'Pitch Trace', tagline: 'See where your voice goes.', desc: 'Watch sung notes travel through time, with octave colors and transposition.', category: 'music', meta: 'LIVE PITCH · MIC INPUT', icon: icons.pitchTrace, render: PitchTrace },
  { id: 'timer', name: 'Timer', tagline: 'Give your time a rhythm.', desc: 'Make room for focus, a workout, or a well-earned break.', category: 'focus', meta: 'COUNTDOWN + INTERVALS', icon: icons.timer, render: TimerApp },
  { id: 'tap-tempo', name: 'Tap Tempo', tagline: 'Feel it. Tap it. Find it.', desc: 'That beat in your head? Put a number to it.', category: 'music', meta: 'TAP TO FIND YOUR BPM', icon: icons.tap, render: TapTempo },
  { id: 'hexic', name: 'Hexic', tagline: 'A fresh angle on downtime.', desc: 'Rotate, connect, and get lost in a little color.', category: 'play', meta: 'A SMALL BRAIN BREAK', icon: icons.hex, render: Hexic },
];
const root = document.getElementById('app');
let cleanups = [];
const onCleanup = (fn) => cleanups.push(fn);
function runCleanups() {
  while (cleanups.length) { try { cleanups.pop()(); } catch {} }
}
let deferredPrompt = null;
let offlineReady = false;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  toast('Your toolbox is installed. Make yourself at home.');
});
function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
}
function connectionLabel() {
  return offlineReady ? 'Ready for offline' : navigator.onLine ? 'Made to work offline' : 'You’re offline';
}
function updateConnection() {
  document.querySelectorAll('.connection-label').forEach((node) => { node.textContent = connectionLabel(); });
}
window.addEventListener('online', updateConnection);
window.addEventListener('offline', updateConnection);
if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(() => { offlineReady = true; updateConnection(); });

function topbar(active) {
  return el('header', { className: 'topbar' }, [
    el('a', { className: 'brand', href: '#/', 'aria-label': 'HackNSeek home' }, [
      el('span', { className: 'logo', 'aria-hidden': 'true', innerHTML: icons.brand }),
      el('span', {}, ['hack', el('span', { className: 'brand-n' }, 'n'), 'seek', el('span', { className: 'brand-period' }, '.')]),
    ]),
    active ? el('a', { className: 'header-link', href: '#/' }, 'All tools') : el('nav', { className: 'header-nav', 'aria-label': 'Main navigation' }, [
      el('button', { className: 'header-link is-active', onclick: () => scrollToSection('collection') }, 'The collection'),
      el('button', { className: 'header-link', onclick: () => scrollToSection('approach') }, 'The idea'),
    ]),
    el('div', { className: 'header-right' }, [
      el('span', { className: 'connection' }, [el('i', { 'aria-hidden': 'true' }), el('span', { className: 'connection-label' }, connectionLabel())]),
      el('a', { className: 'source-link', href: GITHUB_URL, target: '_blank', rel: 'noopener', 'aria-label': 'View source on GitHub', innerHTML: icons.github }),
    ]),
  ]);
}
function footer() {
  return el('footer', { className: 'foot' }, [
    el('span', {}, ['A little less friction. ', el('span', { className: 'footer-dark' }, 'A little more flow.')]),
    el('div', { className: 'row' }, [
      el('a', { href: GITHUB_URL, target: '_blank', rel: 'noopener' }, 'Open source ↗'),
      el('button', { className: 'version-btn', onclick: () => checkForUpdate(true), title: 'Check for updates' }, `v${APP_VERSION}`),
    ]),
  ]);
}
async function installApp() {
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
    toast('You’re already using the installed app.');
    return;
  }
  if (deferredPrompt) {
    const prompt = deferredPrompt;
    deferredPrompt = null;
    await prompt.prompt();
    await prompt.userChoice;
    return;
  }
  const dialog = el('dialog', { className: 'install-dialog' }, [
    el('span', { className: 'eyebrow' }, 'TAKE YOUR TOOLS WITH YOU'),
    el('h2', {}, 'A place on your home screen.'),
    el('p', {}, 'In Safari on iPhone or iPad, open Share and choose “Add to Home Screen”. In Chrome or Edge, look for “Install app” in the browser menu or address bar when available.'),
    el('p', { className: 'muted' }, 'You can also bookmark this page. Your tools work offline after the first complete load.'),
    el('button', { className: 'btn primary', onclick: () => dialog.close() }, 'Got it'),
  ]);
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  mainElement().append(dialog);
  dialog.showModal();
  onCleanup(() => dialog.remove());
}
function mainElement() { return document.getElementById('main'); }

function hub(main) {
  const hero = el('section', { className: 'hero' }, [
    el('div', { className: 'hero-copy' }, [
      el('div', { className: 'eyebrow' }, [el('span', { className: 'mini-cross', 'aria-hidden': 'true' }, '+'), ' SMALL TOOLS. OPEN POSSIBILITIES.']),
      el('h1', {}, ['Less noise.', el('br'), 'More ', el('span', { className: 'flow-word' }, 'flow.' )]),
      el('p', {}, 'Find your rhythm. Fine-tune your focus. A thoughtful collection of everyday tools, right here in your browser.'),
      el('button', { className: 'btn primary hero-cta', onclick: () => scrollToSection('collection') }, ['Find your tool', el('span', { 'aria-hidden': 'true' }, '↘')]),
      el('div', { className: 'hero-note' }, 'NO SIGN-UP. NO DISTRACTIONS. JUST OPEN & GO.'),
    ]),
    el('div', { className: 'hero-art', 'aria-hidden': 'true', innerHTML: artwork.hero }),
  ]);
  const grid = el('div', { className: 'apps' });
  const count = el('span', { className: 'collection-count', role: 'status', 'aria-live': 'polite' }, `${String(APPS.length).padStart(2, '0')} tools, countless possibilities`);
  const filters = el('div', { className: 'filters', role: 'group', 'aria-label': 'Filter tools' });
  let active = 'all';
  function showTools(category) {
    active = category;
    const filtered = APPS.filter((app) => category === 'all' || app.category === category);
    grid.classList.toggle('is-filtered', category !== 'all');
    grid.replaceChildren(...filtered.map((app) => el('a', { className: `tool-card tool-${app.id}`, href: '#' + app.id, 'aria-label': `Open ${app.name}` }, [
      el('div', { className: 'card-top' }, [
        el('span', { className: 'tool-kind' }, [el('span', { className: 'tool-small-icon', 'aria-hidden': 'true', innerHTML: app.icon }), app.category === 'music' ? 'MAKE MUSIC' : app.category === 'focus' ? 'FIND FOCUS' : 'TAKE A BREAK']),
        el('span', { className: 'card-arrow', 'aria-hidden': 'true' }, '↗'),
      ]),
      el('div', { className: 'tool-art', 'aria-hidden': 'true', innerHTML: artwork[app.id] }),
      el('div', { className: 'card-copy' }, [el('h3', {}, app.name), el('p', {}, app.desc)]),
      el('div', { className: 'card-meta' }, [el('span', {}, app.meta), el('span', {}, String(APPS.indexOf(app) + 1).padStart(2, '0'))]),
    ])));
    filters.querySelectorAll('button').forEach((button) => {
      const selected = button.dataset.category === active;
      button.classList.toggle('is-on', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    count.textContent = `${String(filtered.length).padStart(2, '0')} ${filtered.length === 1 ? 'tool' : 'tools'}, countless possibilities`;
  }
  for (const [category, label] of [['all', 'All tools'], ['music', 'Music'], ['focus', 'Focus'], ['play', 'Play']]) {
    filters.append(el('button', { className: 'filter-btn', 'data-category': category, onclick: () => showTools(category) }, label));
  }
  const collection = el('section', { className: 'collection', id: 'collection', 'aria-labelledby': 'collection-heading' }, [
    el('div', { className: 'section-heading' }, [el('div', {}, [el('span', { className: 'eyebrow' }, 'THE COLLECTION'), el('h2', { id: 'collection-heading' }, 'Good things. Small packages.')]), count]),
    filters, grid,
  ]);
  const approach = el('section', { className: 'approach', id: 'approach' }, [
    el('div', { className: 'approach-heading' }, [el('span', { className: 'eyebrow' }, 'A TOOLBOX, NOT A TO-DO LIST'), el('h2', {}, ['Made for the moment.', el('br'), 'Ready when you are.'])]),
    el('div', { className: 'principles' }, [
      el('div', {}, [el('span', { className: 'principle-icon', 'aria-hidden': 'true', innerHTML: icons.offline }), el('h3', {}, 'Go a little offline.'), el('p', {}, 'Load once, use anywhere. Your tools stay with you, even when the connection doesn’t.')]),
      el('div', {}, [el('span', { className: 'principle-icon', 'aria-hidden': 'true', innerHTML: icons.open }), el('h3', {}, 'Yours to explore.'), el('p', {}, 'Free to use and open source. No accounts, no tracking, and nothing between you and getting started.')]),
    ]),
  ]);
  const install = el('section', { className: 'install-strip' }, [
    el('div', { className: 'row' }, [el('span', { className: 'install-icon', 'aria-hidden': 'true', innerHTML: icons.install }), el('div', {}, [el('h3', {}, 'Your pocket-sized creative companion.'), el('p', {}, 'Keep the whole collection one tap away.')])]),
    el('button', { className: 'btn', id: 'installBtn', onclick: installApp }, ['Install the app', el('span', { 'aria-hidden': 'true' }, '↗')]),
  ]);
  main.append(hero, collection, approach, install);
  showTools('all');
}
function parseRoute() {
  return (location.hash || '').replace(/^#\/?/, '').toLowerCase().split('/').filter(Boolean);
}
function render() {
  runCleanups();
  const [id] = parseRoute();
  const app = APPS.find((entry) => entry.id === id);
  if (id && !app) { location.replace('#/'); return; }
  document.title = app ? `${app.name} — HackNSeek` : 'HackNSeek — Small tools. More flow.';
  root.replaceChildren(el('a', { className: 'skip-link', href: '#main', onclick: (event) => { event.preventDefault(); mainElement().focus(); } }, 'Skip to content'), topbar(app));
  const main = el('main', { className: app ? `col tool-view view-${app.id}` : 'hub', id: 'main', tabIndex: -1 });
  root.append(main);
  if (app) {
    main.append(el('nav', { className: 'tool-nav', 'aria-label': 'Tools' }, APPS.map((entry) => el('a', { className: entry.id === id ? 'is-current' : '', href: '#' + entry.id, ...(entry.id === id ? { 'aria-current': 'page' } : {}) }, [el('span', { 'aria-hidden': 'true', innerHTML: entry.icon }), entry.name]))));
    app.render({ main, onCleanup });
    main.append(el('p', { className: 'tool-endnote' }, app.tagline));
  } else hub(main);
  root.append(footer());
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', () => { render(); mainElement()?.focus({ preventScroll: true }); });
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
    try { await reg.update(); } catch {
      if (manual) toast("Couldn’t check for updates. Try again when you’re online.");
      return;
    } finally {
      reg.removeEventListener('updatefound', onUpdateFound);
    }

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

import { el, store, clamp, fmtTime, viewHead } from '../dom.js';
import { icons } from '../icons.js';

const QUICK_PRESETS = [30, 60, 90, 120, 180, 300, 600, 900];
const INTERVAL_PRESETS = [
  ['Tabata', 20, 10, 8],
  ['HIIT 30/30', 30, 30, 10],
  ['EMOM 1:00', 60, 0, 10],
  ['Boxing 3:00', 180, 60, 5],
];

export function TimerApp({ main, onCleanup }) {
  const s = {
    mode: 'once',
    total: clamp(store.get('timer.total', 60) | 0, 1, 10800),
    work: clamp(store.get('timer.work', 30) | 0, 1, 3600),
    rest: clamp(store.get('timer.rest', 10) | 0, 0, 3600),
    rounds: clamp(store.get('timer.rounds', 8) | 0, 1, 99),
  };

  let remaining = s.total;
  let endAt = 0;
  let rafId = 0;
  let running = false;
  let sessionActive = false;
  let phase = 'work';
  let round = 0;
  let audio = null;

  main.append(viewHead('Timer', 'Countdown and interval timer'));

  const tabOnce = el('button', { className: 'pill-btn' }, 'Countdown');
  const tabInt = el('button', { className: 'pill-btn' }, 'Intervals');

  const display = el('div', { className: 'big-number' }, fmtTime(remaining));
  const status = el('div', { className: 'muted', style: 'text-align:center' }, 'ready');
  const playBtn = el('button', { className: 'btn play', 'aria-label': 'Start', innerHTML: icons.play });
  const resetBtn = el('button', { className: 'btn ghost' }, 'Reset');

  const minIn = el('input', { type: 'number', min: 0, max: 180, value: Math.floor(s.total / 60), 'aria-label': 'Minutes' });
  const secIn = el('input', { type: 'number', min: 0, max: 59, value: s.total % 60, 'aria-label': 'Seconds' });

  const quickGrid = el('div', { className: 'preset-grid' });
  for (const sec of QUICK_PRESETS) {
    const b = el('button', { className: 'btn' }, fmtTime(sec));
    b.addEventListener('click', () => {
      minIn.value = Math.floor(sec / 60);
      secIn.value = sec % 60;
      applyOnce();
      b.blur();
    });
    quickGrid.append(b);
  }

  const oncePanel = el('section', { className: 'panel' }, [
    el('div', { className: 'panel-row' }, [
      el('label', {}, ['Minutes ', minIn]),
      el('label', {}, ['Seconds ', secIn]),
    ]),
    el('div', { className: 'col' }, [el('h3', {}, 'Quick'), quickGrid]),
  ]);

  const workIn = el('input', { type: 'number', min: 1, max: 3600, value: s.work, 'aria-label': 'Work seconds' });
  const restIn = el('input', { type: 'number', min: 0, max: 3600, value: s.rest, 'aria-label': 'Rest seconds' });
  const roundsIn = el('input', { type: 'number', min: 1, max: 99, value: s.rounds, 'aria-label': 'Rounds' });

  const intPresets = el('div', { className: 'preset-grid' });
  for (const [name, w, r, rd] of INTERVAL_PRESETS) {
    const b = el('button', { className: 'btn' }, name);
    b.addEventListener('click', () => {
      s.work = w;
      s.rest = r;
      s.rounds = rd;
      workIn.value = w;
      restIn.value = r;
      roundsIn.value = rd;
      store.set('timer.work', w);
      store.set('timer.rest', r);
      store.set('timer.rounds', rd);
      switchMode('interval');
      b.blur();
    });
    intPresets.append(b);
  }

  const intPanel = el('section', { className: 'panel' }, [
    el('div', { className: 'panel-row' }, [
      el('label', {}, ['Work (s) ', workIn]),
      el('label', {}, ['Rest (s) ', restIn]),
      el('label', {}, ['Rounds ', roundsIn]),
    ]),
    intPresets,
  ]);

  main.append(
    el('div', { className: 'pillset' }, [tabOnce, tabInt]),
    el('section', { className: 'panel' }, [
      oncePanel,
      intPanel,
      el('div', { className: 'col', style: 'align-items:center;gap:4px' }, [display, status]),
      el('div', { className: 'panel-row', style: 'justify-content:center;gap:14px' }, [playBtn, resetBtn]),
    ])
  );

  function ensureAudio() {
    if (!audio) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audio = new AC();
    }
    if (audio.state === 'suspended') {
      try { audio.resume(); } catch {}
    }
    return audio;
  }

  function beep(freq, dur) {
    const ctx = ensureAudio();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function alarm() {
    beep(660, 0.15);
    setTimeout(() => beep(880, 0.15), 200);
    setTimeout(() => beep(1100, 0.3), 400);
    try { navigator.vibrate && navigator.vibrate([120, 80, 120, 80, 300]); } catch {}
  }

  function phaseLength() {
    return phase === 'work' ? s.work : s.rest;
  }

  function setStatus(text) {
    status.textContent = text;
  }

  function setPlayIcon(isPlaying) {
    playBtn.classList.toggle('is-on', isPlaying);
    playBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Start');
    playBtn.innerHTML = isPlaying ? icons.pause : icons.play;
  }

  function pause() {
    running = false;
    cancelAnimationFrame(rafId);
    setPlayIcon(false);
  }

  function beginSession() {
    if (s.mode === 'once') {
      remaining = s.total;
      setStatus('Running');
    } else {
      phase = 'work';
      round = 0;
      remaining = s.work;
      setStatus(`Round 1/${s.rounds} \u00b7 Work`);
    }
    sessionActive = true;
  }

  function start() {
    if (running) return;
    ensureAudio();
    if (!sessionActive) beginSession();
    running = true;
    endAt = performance.now() + remaining * 1000;
    setPlayIcon(true);
    rafId = requestAnimationFrame(tick);
  }

  function tick() {
    if (!running) return;
    remaining = Math.max(0, (endAt - performance.now()) / 1000);
    display.textContent = fmtTime(remaining);
    if (remaining <= 0) {
      advance();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function finish() {
    pause();
    sessionActive = false;
    setStatus('Done!');
    alarm();
  }

  function advance() {
    if (s.mode === 'once') {
      finish();
      return;
    }
    beep(880, 0.18);
    if (phase === 'work' && s.rest > 0) {
      phase = 'rest';
      setStatus(`Round ${round + 1}/${s.rounds} \u00b7 Rest`);
    } else {
      round++;
      if (round >= s.rounds) {
        finish();
        return;
      }
      phase = 'work';
      setStatus(`Round ${round + 1}/${s.rounds} \u00b7 Work`);
    }
    remaining = phaseLength();
    endAt = performance.now() + remaining * 1000;
    rafId = requestAnimationFrame(tick);
  }

  function hardReset() {
    pause();
    sessionActive = false;
    if (s.mode === 'once') {
      remaining = s.total;
      setStatus('ready');
    } else {
      phase = 'work';
      round = 0;
      remaining = s.work;
      setStatus(`Round 1/${s.rounds} \u00b7 Work`);
    }
    display.textContent = fmtTime(remaining);
  }

  function applyOnce() {
    const mins = Math.max(0, parseInt(minIn.value, 10) || 0);
    const secs = Math.max(0, parseInt(secIn.value, 10) || 0) % 60;
    s.total = Math.max(1, mins * 60 + secs);
    store.set('timer.total', s.total);
    hardReset();
  }

  function bindField(input, key, fallback, lo, hi) {
    input.addEventListener('change', () => {
      s[key] = clamp(parseInt(input.value, 10) || fallback, lo, hi);
      input.value = s[key];
      store.set('timer.' + key, s[key]);
      hardReset();
    });
  }

  function switchMode(mode) {
    s.mode = mode;
    tabOnce.classList.toggle('is-on', mode === 'once');
    tabInt.classList.toggle('is-on', mode === 'interval');
    oncePanel.hidden = mode !== 'once';
    intPanel.hidden = mode !== 'interval';
    hardReset();
  }

  tabOnce.addEventListener('click', () => switchMode('once'));
  tabInt.addEventListener('click', () => switchMode('interval'));
  playBtn.addEventListener('click', () => {
    playBtn.blur();
    running ? pause() : start();
  });
  resetBtn.addEventListener('click', () => {
    resetBtn.blur();
    hardReset();
  });
  minIn.addEventListener('change', applyOnce);
  secIn.addEventListener('change', applyOnce);
  bindField(workIn, 'work', 30, 1, 3600);
  bindField(restIn, 'rest', 0, 0, 3600);
  bindField(roundsIn, 'rounds', 8, 1, 99);

  switchMode('once');

  onCleanup(() => {
    pause();
    if (audio) {
      try { audio.close(); } catch {}
    }
  });
}

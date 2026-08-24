import { el, $$, store, clamp, viewHead, audioContext } from '../dom.js';
import { icons } from '../icons.js';

const SIGNATURES = ['2/4', '3/4', '4/4', '5/4', '6/8', '7/8'];
const SOUND_NAMES = [
  ['click', 'Click'],
  ['beep', 'Beep'],
  ['wood', 'Wood block'],
  ['cowbell', 'Cowbell'],
  ['snare', 'Snare'],
];
const TEMPO_PRESETS = [
  ['Largo', 60], ['Adagio', 72], ['Andante', 84], ['Moderato', 108],
  ['Allegro', 132], ['Vivace', 160], ['Presto', 184], ['Prestissimo', 210],
];
const MIN_BPM = 30;
const MAX_BPM = 260;

function noiseBuffer(ctx, seconds) {
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * seconds)), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function createVoices(ctx, out) {
  const decay = (gainNode, t, peak, dur) => {
    gainNode.gain.setValueAtTime(peak, t);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  };
  const tone = (type, freq, t, dur) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
    return g;
  };
  return {
    click(t, acc) {
      decay(tone('square', acc ? 1800 : 1200, t, 0.05), t, acc ? 0.9 : 0.6, 0.05);
    },
    beep(t, acc) {
      decay(tone('sine', acc ? 1320 : 880, t, 0.12), t, 0.6, 0.12);
    },
    wood(t, acc) {
      decay(tone('triangle', acc ? 900 : 700, t, 0.06), t, 0.8, 0.06);
    },
    cowbell(t, acc) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(acc ? 1100 : 950, t);
      bp.Q.value = 4;
      const g = ctx.createGain();
      decay(g, t, 0.5, 0.18);
      bp.connect(g).connect(out);
      for (const f of acc ? [940, 1300] : [800, 1100]) {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.setValueAtTime(f, t);
        o.connect(bp);
        o.start(t);
        o.stop(t + 0.2);
      }
    },
    snare(t, acc) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx, 0.2);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1500;
      const g = ctx.createGain();
      decay(g, t, acc ? 0.9 : 0.6, 0.18);
      src.connect(hp).connect(g).connect(out);
      src.start(t);
    },
  };
}

export function Metronome({ main, onCleanup }) {
  const s = {
    bpm: clamp(store.get('metro.bpm', 120) | 0, MIN_BPM, MAX_BPM),
    sig: store.get('metro.sig', '4/4'),
    sound: store.get('metro.sound', 'click'),
    volume: store.get('metro.vol', 0.6),
  };

  let ctx = null;
  let master = null;
  let voices = null;
  let running = false;
  let beat = 0;
  let nextTime = 0;
  let loopId = 0;
  let gen = 0;
  const taps = [];

  main.append(viewHead('Metronome', 'BPM, time signature, sound'));

  const bpmValue = el('div', { className: 'big-number' }, String(s.bpm));
  const bpmLabel = el('div', { className: 'muted', style: 'text-align:center' }, 'beats per minute');
  const downBtn = el('button', { className: 'btn round', 'aria-label': 'Decrease tempo', innerHTML: icons.minus });
  const upBtn = el('button', { className: 'btn round', 'aria-label': 'Increase tempo', innerHTML: icons.plus });
  const bpmSlider = el('input', { type: 'range', min: MIN_BPM, max: MAX_BPM, step: 1, value: s.bpm, 'aria-label': 'Tempo' });

  const sigSelect = el('select', { 'aria-label': 'Time signature' });
  for (const v of SIGNATURES) {
    const o = el('option', { value: v }, v);
    if (v === s.sig) o.selected = true;
    sigSelect.append(o);
  }

  const soundSelect = el('select', { 'aria-label': 'Sound' });
  for (const [v, label] of SOUND_NAMES) {
    const o = el('option', { value: v }, label);
    if (v === s.sound) o.selected = true;
    soundSelect.append(o);
  }

  const dotsRow = el('div', { className: 'dot-row', style: 'justify-content:center' });
  const playBtn = el('button', { className: 'btn play', 'aria-label': 'Play', innerHTML: icons.play });
  const resetBtn = el('button', { className: 'btn ghost' }, 'Reset');
  const volSlider = el('input', { type: 'range', min: 0, max: 1, step: 0.01, value: s.volume, 'aria-label': 'Volume' });

  const presetGrid = el('div', { className: 'preset-grid' });
  for (const [name, bpm] of TEMPO_PRESETS) {
    const b = el('button', { className: 'btn' }, `${name} \u00b7 ${bpm}`);
    b.addEventListener('click', () => { setBPM(bpm); b.blur(); });
    presetGrid.append(b);
  }

  const tapBtn = el('button', { className: 'btn' }, 'Tap to set BPM');

  main.append(
    el('section', { className: 'panel' }, [
      el('div', { className: 'col', style: 'align-items:center;gap:4px' }, [bpmValue, bpmLabel]),
      el('div', { className: 'panel-row', style: 'gap:14px' }, [downBtn, bpmSlider, upBtn]),
      el('div', { className: 'panel-row between' }, [
        el('label', {}, ['Time signature ', sigSelect]),
        el('label', {}, ['Sound ', soundSelect]),
      ]),
      dotsRow,
      el('div', { className: 'panel-row', style: 'justify-content:center;gap:14px' }, [playBtn, resetBtn]),
      el('div', { className: 'panel-row' }, [el('label', { style: 'min-width:80px' }, 'Volume'), volSlider]),
      el('div', {}, [el('h3', {}, 'Presets'), presetGrid]),
      el('div', { className: 'panel-row between' }, [
        el('span', { className: 'muted' }, 'Tip: tap along to set BPM'),
        tapBtn,
      ]),
      el('div', { className: 'muted', style: 'font-size:0.85rem' }, 'Shortcuts: Space play \u00b7 \u2191/\u2193 \u00b15 BPM \u00b7 R reset'),
    ])
  );

  function beatsPerBar() {
    return parseInt(s.sig, 10) || 4;
  }

  function buildDots() {
    dotsRow.replaceChildren();
    for (let i = 0; i < beatsPerBar(); i++) {
      dotsRow.append(el('div', { className: 'dot' + (i === 0 ? ' is-accent' : '') }));
    }
  }

  function setBPM(v) {
    s.bpm = clamp(Math.round(v), MIN_BPM, MAX_BPM);
    bpmValue.textContent = String(s.bpm);
    bpmSlider.value = s.bpm;
    store.set('metro.bpm', s.bpm);
  }

  function ensureAudio() {
    if (!ctx) {
      ctx = audioContext();
      master = ctx.createGain();
      master.gain.value = s.volume;
      master.connect(ctx.destination);
      voices = createVoices(ctx, master);
    }
    return ctx;
  }

  function applyVolume() {
    if (master) master.gain.setTargetAtTime(s.volume, ctx.currentTime, 0.01);
  }

  function scheduleBeat(b, t, myGen) {
    voices[s.sound](t, b === 0);
    const delay = Math.max(0, (t - ctx.currentTime) * 1000);
    setTimeout(() => {
      if (myGen !== gen || !running) return;
      $$('.dot', dotsRow).forEach((d, i) => d.classList.toggle('is-on', i === b));
    }, delay);
  }

  function loop() {
    while (nextTime < ctx.currentTime + 0.12) {
      scheduleBeat(beat, nextTime, gen);
      nextTime += 60 / s.bpm;
      beat = (beat + 1) % beatsPerBar();
    }
    loopId = setTimeout(loop, 25);
  }

  async function start() {
    if (running) return;
    ensureAudio();
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch {}
    }
    if (ctx.state !== 'running') return;
    running = true;
    gen++;
    beat = 0;
    nextTime = ctx.currentTime + 0.06;
    playBtn.classList.add('is-on');
    playBtn.setAttribute('aria-label', 'Pause');
    playBtn.innerHTML = icons.pause;
    loop();
  }

  function stop() {
    if (!running) return;
    gen++;
    running = false;
    clearTimeout(loopId);
    playBtn.classList.remove('is-on');
    playBtn.setAttribute('aria-label', 'Play');
    playBtn.innerHTML = icons.play;
    $$('.dot', dotsRow).forEach((d) => d.classList.remove('is-on'));
  }

  function reset() {
    stop();
    beat = 0;
  }

  downBtn.addEventListener('click', () => { setBPM(s.bpm - 1); downBtn.blur(); });
  upBtn.addEventListener('click', () => { setBPM(s.bpm + 1); upBtn.blur(); });
  bpmSlider.addEventListener('input', (e) => setBPM(+e.target.value));

  sigSelect.addEventListener('change', (e) => {
    s.sig = e.target.value;
    store.set('metro.sig', s.sig);
    buildDots();
    if (running) {
      stop();
      start();
    }
  });

  soundSelect.addEventListener('change', (e) => {
    s.sound = e.target.value;
    store.set('metro.sound', s.sound);
  });

  volSlider.addEventListener('input', (e) => {
    s.volume = +e.target.value;
    store.set('metro.vol', s.volume);
    applyVolume();
  });

  playBtn.addEventListener('click', () => { playBtn.blur(); running ? stop() : start(); });
  resetBtn.addEventListener('click', () => { resetBtn.blur(); reset(); });

  tapBtn.addEventListener('click', () => {
    const now = performance.now();
    taps.push(now);
    while (taps.length && now - taps[0] > 3000) taps.shift();
    if (taps.length >= 2) {
      setBPM(60000 / ((now - taps[0]) / (taps.length - 1)));
    }
    tapBtn.blur();
  });

  function onKey(e) {
    if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.code === 'Space') {
      e.preventDefault();
      running ? stop() : start();
    } else if (e.code === 'ArrowUp') {
      e.preventDefault();
      setBPM(s.bpm + 5);
    } else if (e.code === 'ArrowDown') {
      e.preventDefault();
      setBPM(s.bpm - 5);
    } else if (e.key === 'r' || e.key === 'R') {
      reset();
    } else if (e.key === 'Escape') {
      stop();
    }
  }
  document.addEventListener('keydown', onKey);

  buildDots();

  onCleanup(() => {
    document.removeEventListener('keydown', onKey);
    gen++;
    running = false;
    clearTimeout(loopId);
    if (ctx) {
      try { ctx.close(); } catch {}
    }
  });
}

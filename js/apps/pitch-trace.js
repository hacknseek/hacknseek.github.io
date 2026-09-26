import { el, store, clamp, viewHead } from '../dom.js';
import { autoCorrelate, frequencyToMidi, midiNote, NOTE_NAMES } from '../pitch.js';

const A4_OPTIONS = [432, 440, 442, 444];
const WINDOW_OPTIONS = [5, 10, 15, 30];
const MIN_MIDI = 36; // C2
const MAX_MIDI = 95; // B6
const SAMPLE_INTERVAL = 45;
const SENS_T_LOUD = 0.06;
const SENS_T_QUIET = 0.0005;
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MAJOR_KEYS = [
  { value: 'C', label: 'C', root: 0, notes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'] },
  { value: 'Db', label: 'D♭', root: 1, notes: ['D♭', 'E♭', 'F', 'G♭', 'A♭', 'B♭', 'C'] },
  { value: 'D', label: 'D', root: 2, notes: ['D', 'E', 'F♯', 'G', 'A', 'B', 'C♯'] },
  { value: 'Eb', label: 'E♭', root: 3, notes: ['E♭', 'F', 'G', 'A♭', 'B♭', 'C', 'D'] },
  { value: 'E', label: 'E', root: 4, notes: ['E', 'F♯', 'G♯', 'A', 'B', 'C♯', 'D♯'] },
  { value: 'F', label: 'F', root: 5, notes: ['F', 'G', 'A', 'B♭', 'C', 'D', 'E'] },
  { value: 'Fs', label: 'F♯', root: 6, notes: ['F♯', 'G♯', 'A♯', 'B', 'C♯', 'D♯', 'E♯'] },
  { value: 'G', label: 'G', root: 7, notes: ['G', 'A', 'B', 'C', 'D', 'E', 'F♯'] },
  { value: 'Ab', label: 'A♭', root: 8, notes: ['A♭', 'B♭', 'C', 'D♭', 'E♭', 'F', 'G'] },
  { value: 'A', label: 'A', root: 9, notes: ['A', 'B', 'C♯', 'D', 'E', 'F♯', 'G♯'] },
  { value: 'Bb', label: 'B♭', root: 10, notes: ['B♭', 'C', 'D', 'E♭', 'F', 'G', 'A'] },
  { value: 'B', label: 'B', root: 11, notes: ['B', 'C♯', 'D♯', 'E', 'F♯', 'G♯', 'A♯'] },
];
const OCTAVE_COLORS = {
  2: '#c9674b',
  3: '#bf8b2e',
  4: '#4c8a67',
  5: '#397e9c',
  6: '#7b63a4',
};
const NATURAL_NOTES = new Set([0, 2, 4, 5, 7, 9, 11]);

function sliderToThreshold(value) {
  const k = (clamp(value, 1, 100) - 1) / 99;
  return SENS_T_LOUD * Math.pow(SENS_T_QUIET / SENS_T_LOUD, k);
}

function thresholdToSlider(threshold) {
  const k = Math.log(clamp(threshold, SENS_T_QUIET, SENS_T_LOUD) / SENS_T_LOUD) /
    Math.log(SENS_T_QUIET / SENS_T_LOUD);
  return Math.round(1 + 99 * k);
}

function octaveColor(octave) {
  return OCTAVE_COLORS[clamp(octave, 2, 6)] || '#54625a';
}

function transposeLabel(value) {
  if (value === 0) return '0 · concert pitch';
  if (value === 12) return '+12 · one octave up';
  if (value === -12) return '−12 · one octave down';
  return `${value > 0 ? '+' : '−'}${Math.abs(value)} semitone${Math.abs(value) === 1 ? '' : 's'}`;
}

export function PitchTrace({ main, onCleanup }) {
  const s = {
    a4: store.get('tuner.a4', 440),
    sensitivity: store.get('pitch-trace.sensitivity', store.get('tuner.sens', 0.004)),
    transpose: store.get('pitch-trace.transpose', 0),
    seconds: store.get('pitch-trace.seconds', 10),
    view: store.get('pitch-trace.view', 'range'),
    key: store.get('pitch-trace.key', 'C'),
  };
  if (!['range', 'octave'].includes(s.view)) s.view = 'range';
  if (!MAJOR_KEYS.some((key) => key.value === s.key)) s.key = 'C';

  let ctx = null;
  let analyser = null;
  let stream = null;
  let buffer = null;
  let rafId = 0;
  let running = false;
  let starting = false;
  let disposed = false;
  let lastSampleAt = 0;
  let lastSignalAt = 0;
  let lastFrequency = 0;
  const history = [];
  const smoothBuffer = [];

  main.append(viewHead('Pitch Trace', 'Live voice pitch over time'));

  const errText = el('div');
  const errBox = el('div', { className: 'panel trace-error', role: 'alert', hidden: true }, errText);
  const currentNote = el('strong', { className: 'trace-current-note' }, '--');
  const currentDetail = el('span', { className: 'trace-current-detail' }, 'waiting for a note');
  const current = el('div', { className: 'trace-current', role: 'status', 'aria-live': 'polite' }, [
    el('span', { className: 'eyebrow' }, 'NOW'),
    currentNote,
    currentDetail,
  ]);
  const rangeButton = el('button', {
    className: `trace-view-btn${s.view === 'range' ? ' is-on' : ''}`,
    'aria-pressed': String(s.view === 'range'),
  }, 'Full range');
  const octaveButton = el('button', {
    className: `trace-view-btn${s.view === 'octave' ? ' is-on' : ''}`,
    'aria-pressed': String(s.view === 'octave'),
  }, 'One octave');
  const viewToggle = el('div', { className: 'trace-view-toggle', role: 'group', 'aria-label': 'Pitch graph view' }, [
    rangeButton,
    octaveButton,
  ]);
  const viewHint = el('span', { className: 'trace-view-hint', hidden: s.view !== 'octave' }, 'Green bands = ±5 cents');
  const scaleSummary = el('div', { className: 'trace-scale-summary', role: 'status' });
  const canvas = el('canvas', {
    className: 'pitch-canvas',
    role: 'img',
    'aria-label': graphAriaLabel(),
  });
  const graphContext = canvas.getContext('2d');
  const legend = el('div', { className: 'octave-legend', 'aria-label': 'Octave colors' },
    Object.entries(OCTAVE_COLORS).map(([octave, color]) => el('span', {}, [
      el('i', { style: `--dot-color:${color}`, 'aria-hidden': 'true' }),
      `Octave ${octave}`,
    ]))
  );

  const levelFill = el('span');
  const levelBar = el('div', { className: 'bar trace-level' }, levelFill);
  main.append(
    errBox,
    el('section', { className: 'panel pitch-stage' }, [
      el('div', { className: 'trace-topline' }, [
        current,
        el('div', { className: 'trace-display-options' }, [viewToggle, viewHint, scaleSummary, legend]),
      ]),
      canvas,
      el('div', { className: 'panel-row trace-input-row' }, [
        el('label', {}, 'Input level'),
        levelBar,
      ]),
    ])
  );

  const transposeSelect = el('select', { 'aria-label': 'Transpose detected notes' });
  for (let value = -12; value <= 12; value++) {
    const option = el('option', { value }, transposeLabel(value));
    if (value === s.transpose) option.selected = true;
    transposeSelect.append(option);
  }

  const keySelect = el('select', { 'aria-label': 'Major key' });
  for (const key of MAJOR_KEYS) {
    const option = el('option', { value: key.value }, `${key.label} major`);
    if (key.value === s.key) option.selected = true;
    keySelect.append(option);
  }

  const a4Select = el('select', { 'aria-label': 'A4 reference frequency' });
  for (const value of A4_OPTIONS) {
    const option = el('option', { value }, `A4 = ${value} Hz`);
    if (value === s.a4) option.selected = true;
    a4Select.append(option);
  }

  const windowSelect = el('select', { 'aria-label': 'Visible time window' });
  for (const value of WINDOW_OPTIONS) {
    const option = el('option', { value }, `${value} seconds`);
    if (value === s.seconds) option.selected = true;
    windowSelect.append(option);
  }

  const sensitivity = el('input', {
    type: 'range',
    min: 1,
    max: 100,
    step: 1,
    value: thresholdToSlider(s.sensitivity),
    'aria-label': 'Microphone sensitivity',
  });
  const startButton = el('button', { className: 'btn primary big' }, 'Start listening');
  const clearButton = el('button', { className: 'btn' }, 'Clear trace');

  main.append(el('section', { className: 'panel trace-controls' }, [
    el('div', { className: 'trace-settings' }, [
      el('label', {}, ['Major key', keySelect]),
      el('label', {}, ['Transpose', transposeSelect]),
      el('label', {}, ['Reference', a4Select]),
      el('label', {}, ['Time window', windowSelect]),
    ]),
    el('div', { className: 'panel-row' }, [el('label', {}, 'Sensitivity'), sensitivity]),
    el('div', { className: 'trace-actions' }, [startButton, clearButton]),
    el('p', { className: 'muted trace-privacy' },
      'Microphone audio is analysed only on this device. Nothing is recorded or uploaded.'),
  ]));

  function plotBounds(width, height) {
    return { left: s.view === 'octave' ? (width < 480 ? 55 : 64) : (width < 480 ? 46 : 58), right: 12, top: 12, bottom: 27 };
  }

  function selectedKey() {
    return MAJOR_KEYS.find((key) => key.value === s.key) || MAJOR_KEYS[0];
  }

  function scaleDegree(pitchClass) {
    const interval = (pitchClass - selectedKey().root + 12) % 12;
    const index = MAJOR_INTERVALS.indexOf(interval);
    return index === -1 ? 0 : index + 1;
  }

  function updateScaleSummary() {
    const key = selectedKey();
    scaleSummary.replaceChildren(
      el('strong', {}, `Gold rows · ${key.label} major`),
      el('span', {}, key.notes.map((note, index) => `${index + 1} ${note}`).join(' · ')),
    );
  }

  function graphAriaLabel() {
    return s.view === 'octave'
      ? `Live pitch graph in one-octave detail view for ${selectedKey().label} major. Time moves from right to left; all octaves are folded onto C through B, gold rows mark scale notes, and green bands show plus or minus 5 cents.`
      : `Live pitch graph in full-range view for ${selectedKey().label} major. Time moves from right to left; marked rows show the selected scale from C2 to B6.`;
  }

  function graphValue(midi) {
    if (s.view === 'range') return midi;
    return (((midi + 0.5) % 12) + 12) % 12 - 0.5;
  }

  function pitchY(midi, height, bounds) {
    const plotHeight = height - bounds.top - bounds.bottom;
    const min = s.view === 'octave' ? -0.5 : MIN_MIDI;
    const max = s.view === 'octave' ? 11.5 : MAX_MIDI;
    return bounds.top + ((max - graphValue(midi)) / (max - min)) * plotHeight;
  }

  function drawGraph(now = performance.now()) {
    const width = canvas.clientWidth || 640;
    const height = canvas.clientHeight || 430;
    const bounds = plotBounds(width, height);
    const plotWidth = width - bounds.left - bounds.right;
    const plotHeight = height - bounds.top - bounds.bottom;
    graphContext.clearRect(0, 0, width, height);
    graphContext.fillStyle = '#f7f8f4';
    graphContext.fillRect(0, 0, width, height);
    graphContext.font = '8px ui-monospace, SFMono-Regular, Consolas, monospace';
    graphContext.textAlign = 'right';
    graphContext.textBaseline = 'middle';

    if (s.view === 'octave') {
      for (let pitchClass = 0; pitchClass < 12; pitchClass++) {
        const degree = scaleDegree(pitchClass);
        if (degree) {
          const scaleTop = pitchY(pitchClass + 0.46, height, bounds);
          const scaleBottom = pitchY(pitchClass - 0.46, height, bounds);
          graphContext.fillStyle = degree === 1 ? 'rgba(191,139,46,.14)' : 'rgba(191,139,46,.065)';
          graphContext.fillRect(bounds.left, scaleTop, plotWidth, scaleBottom - scaleTop);
        }
        const bandTop = pitchY(pitchClass + 0.05, height, bounds);
        const bandBottom = pitchY(pitchClass - 0.05, height, bounds);
        graphContext.fillStyle = 'rgba(66,119,91,.11)';
        graphContext.fillRect(bounds.left, bandTop, plotWidth, Math.max(2, bandBottom - bandTop));

        graphContext.setLineDash([2, 4]);
        graphContext.strokeStyle = 'rgba(71,82,70,.09)';
        for (const offset of [-0.25, 0.25]) {
          const guideY = pitchY(pitchClass + offset, height, bounds);
          graphContext.beginPath();
          graphContext.moveTo(bounds.left, guideY);
          graphContext.lineTo(width - bounds.right, guideY);
          graphContext.stroke();
        }
        graphContext.setLineDash([]);

        const y = pitchY(pitchClass, height, bounds);
        const natural = NATURAL_NOTES.has(pitchClass);
        graphContext.strokeStyle = degree === 1 ? 'rgba(151,107,30,.62)' : degree ? 'rgba(119,96,47,.34)' : natural ? 'rgba(71,82,70,.22)' : 'rgba(71,82,70,.13)';
        graphContext.lineWidth = degree === 1 ? 1.8 : natural || degree ? 1.2 : 1;
        graphContext.beginPath();
        graphContext.moveTo(bounds.left, y);
        graphContext.lineTo(width - bounds.right, y);
        graphContext.stroke();
        graphContext.fillStyle = degree === 1 ? '#8a651e' : degree ? '#4f5d53' : natural ? '#737d74' : '#9ca29b';
        const label = degree ? `${degree} ${selectedKey().notes[degree - 1]}` : NOTE_NAMES[pitchClass].replace('#', '♯');
        graphContext.fillText(label, bounds.left - 7, y);
      }
    } else {
      for (let midi = MIN_MIDI; midi <= MAX_MIDI; midi++) {
        const pitchClass = ((midi % 12) + 12) % 12;
        const degree = scaleDegree(pitchClass);
        if (!degree) continue;
        const y = pitchY(midi, height, bounds);
        const octave = Math.floor(midi / 12) - 1;
        const bandTop = pitchY(midi + 0.18, height, bounds);
        const bandBottom = pitchY(midi - 0.18, height, bounds);
        graphContext.fillStyle = degree === 1 ? 'rgba(191,139,46,.12)' : 'rgba(191,139,46,.045)';
        graphContext.fillRect(bounds.left, bandTop, plotWidth, bandBottom - bandTop);
        graphContext.strokeStyle = degree === 1 ? 'rgba(151,107,30,.5)' : 'rgba(71,82,70,.13)';
        graphContext.lineWidth = degree === 1 ? 1.4 : 1;
        graphContext.beginPath();
        graphContext.moveTo(bounds.left, y);
        graphContext.lineTo(width - bounds.right, y);
        graphContext.stroke();
        graphContext.fillStyle = degree === 1 ? '#8a651e' : '#667269';
        graphContext.fillText(`${degree} ${selectedKey().notes[degree - 1]}${octave}`, bounds.left - 7, y);
      }
    }

    const tickStep = s.seconds <= 10 ? 2 : 5;
    graphContext.textAlign = 'center';
    graphContext.textBaseline = 'top';
    for (let secondsAgo = 0; secondsAgo <= s.seconds; secondsAgo += tickStep) {
      const x = width - bounds.right - (secondsAgo / s.seconds) * plotWidth;
      graphContext.strokeStyle = 'rgba(71,82,70,.12)';
      graphContext.lineWidth = 1;
      graphContext.beginPath();
      graphContext.moveTo(x, bounds.top);
      graphContext.lineTo(x, height - bounds.bottom);
      graphContext.stroke();
      graphContext.fillStyle = '#7b8379';
      graphContext.fillText(secondsAgo === 0 ? 'now' : `−${secondsAgo}s`, x, height - bounds.bottom + 8);
    }

    graphContext.save();
    graphContext.beginPath();
    graphContext.rect(bounds.left, bounds.top, plotWidth, plotHeight);
    graphContext.clip();
    for (const point of history) {
      const age = now - point.time;
      if (age < 0 || age > s.seconds * 1000) continue;
      const displayMidi = frequencyToMidi(point.frequency, s.a4) + s.transpose;
      if (s.view === 'range' && (displayMidi < MIN_MIDI - 0.5 || displayMidi > MAX_MIDI + 0.5)) continue;
      const note = midiNote(displayMidi);
      const x = width - bounds.right - (age / (s.seconds * 1000)) * plotWidth;
      const y = pitchY(displayMidi, height, bounds);
      const radius = age < 130 ? 4.2 : 3.1;
      graphContext.globalAlpha = clamp(1 - age / (s.seconds * 1250), 0.25, 1);
      graphContext.fillStyle = octaveColor(note.octave);
      graphContext.beginPath();
      graphContext.arc(x, y, radius, 0, Math.PI * 2);
      graphContext.fill();
    }
    graphContext.restore();
    graphContext.globalAlpha = 1;

    if (!history.length) {
      graphContext.fillStyle = '#858d82';
      graphContext.font = '11px ui-monospace, SFMono-Regular, Consolas, monospace';
      graphContext.textAlign = 'center';
      graphContext.textBaseline = 'middle';
      graphContext.fillText(running ? 'sing or play a note' : 'start listening to draw your pitch', bounds.left + plotWidth / 2, bounds.top + plotHeight / 2);
    }
  }

  function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 640;
    const height = canvas.clientHeight || 430;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    graphContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGraph();
  }

  function setView(view) {
    s.view = view;
    store.set('pitch-trace.view', s.view);
    rangeButton.classList.toggle('is-on', view === 'range');
    octaveButton.classList.toggle('is-on', view === 'octave');
    rangeButton.setAttribute('aria-pressed', String(view === 'range'));
    octaveButton.setAttribute('aria-pressed', String(view === 'octave'));
    viewHint.hidden = view !== 'octave';
    canvas.setAttribute('aria-label', graphAriaLabel());
    drawGraph();
  }

  function showError(message) {
    errText.textContent = message;
    errBox.hidden = false;
  }

  function clearError() {
    errBox.hidden = true;
  }

  function updateCurrent(frequency) {
    lastFrequency = frequency;
    const concertMidi = frequencyToMidi(frequency, s.a4);
    const display = midiNote(concertMidi + s.transpose);
    const concert = midiNote(concertMidi);
    const degree = scaleDegree(((display.midi % 12) + 12) % 12);
    const displayName = degree ? selectedKey().notes[degree - 1] : display.name.replace('#', '♯');
    currentNote.textContent = `${displayName}${display.octave}`;
    currentNote.style.color = octaveColor(display.octave);
    const cents = Math.round(display.cents);
    const tuning = `${cents > 0 ? '+' : ''}${cents} cents`;
    const concertLabel = s.transpose ? ` · concert ${concert.name}${concert.octave}` : '';
    const scaleLabel = degree ? ` · degree ${degree}` : ` · outside ${selectedKey().label} major`;
    currentDetail.textContent = `${frequency.toFixed(1)} Hz · ${tuning}${concertLabel}${scaleLabel}`;
  }

  function resetCurrent() {
    lastFrequency = 0;
    currentNote.textContent = '--';
    currentNote.style.color = '';
    currentDetail.textContent = 'waiting for a note';
  }

  async function start() {
    if (starting || running || disposed) return;
    clearError();
    if (!navigator.mediaDevices?.getUserMedia) {
      showError('This browser does not support microphone access.');
      return;
    }
    if (window.isSecureContext === false) {
      showError('Microphone access requires HTTPS or localhost.');
      return;
    }
    starting = true;
    startButton.disabled = true;
    startButton.textContent = 'Waiting for microphone…';
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch {}
      }
      if (disposed) return;
      const requestedStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      if (disposed) {
        requestedStream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = requestedStream;
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.6;
      ctx.createMediaStreamSource(stream).connect(analyser);
      buffer = new Float32Array(analyser.fftSize);
      smoothBuffer.length = 0;
      lastSampleAt = 0;
      running = true;
      startButton.textContent = 'Stop listening';
      startButton.classList.add('danger');
      detectLoop();
    } catch (error) {
      if (disposed) return;
      teardown();
      const messages = {
        NotAllowedError: 'Microphone permission was denied.',
        NotFoundError: 'No microphone was found.',
        NotReadableError: 'The microphone is in use by another app.',
        SecurityError: 'Microphone blocked by browser security settings.',
      };
      showError(messages[error?.name] || error?.message || 'Could not start listening.');
    } finally {
      starting = false;
      startButton.disabled = false;
      if (!running) startButton.textContent = 'Start listening';
    }
  }

  function teardown() {
    running = false;
    cancelAnimationFrame(rafId);
    stream?.getTracks().forEach((track) => track.stop());
    if (ctx) {
      try { ctx.close(); } catch {}
    }
    ctx = null;
    stream = null;
    analyser = null;
    levelFill.style.width = '0%';
  }

  function stop() {
    teardown();
    resetCurrent();
    startButton.textContent = 'Start listening';
    startButton.classList.remove('danger');
    drawGraph();
  }

  function smoothedMidi(midi) {
    smoothBuffer.push(midi);
    if (smoothBuffer.length > 5) smoothBuffer.shift();
    const sorted = [...smoothBuffer].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  function detectLoop(now = performance.now()) {
    if (!running) return;
    analyser.getFloatTimeDomainData(buffer);
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
    const rms = Math.sqrt(sum / buffer.length);
    levelFill.style.width = `${clamp(Math.round(rms * 300), 0, 100)}%`;
    const detected = rms > s.sensitivity ? autoCorrelate(buffer, ctx.sampleRate) : -1;

    if (detected > 20) {
      const midi = smoothedMidi(frequencyToMidi(detected, s.a4));
      const frequency = s.a4 * Math.pow(2, (midi - 69) / 12);
      lastSignalAt = now;
      updateCurrent(frequency);
      if (now - lastSampleAt >= SAMPLE_INTERVAL) {
        history.push({ time: now, frequency });
        lastSampleAt = now;
      }
    } else if (now - lastSignalAt > 300) {
      smoothBuffer.length = 0;
      resetCurrent();
    }

    const oldest = now - s.seconds * 1000 - 250;
    while (history.length && history[0].time < oldest) history.shift();
    drawGraph(now);
    rafId = requestAnimationFrame(detectLoop);
  }

  transposeSelect.addEventListener('change', () => {
    s.transpose = Number(transposeSelect.value);
    store.set('pitch-trace.transpose', s.transpose);
    if (lastFrequency) updateCurrent(lastFrequency);
    drawGraph();
  });
  keySelect.addEventListener('change', () => {
    s.key = keySelect.value;
    store.set('pitch-trace.key', s.key);
    updateScaleSummary();
    canvas.setAttribute('aria-label', graphAriaLabel());
    if (lastFrequency) updateCurrent(lastFrequency);
    drawGraph();
  });
  a4Select.addEventListener('change', () => {
    s.a4 = Number(a4Select.value);
    store.set('tuner.a4', s.a4);
    smoothBuffer.length = 0;
    if (lastFrequency) updateCurrent(lastFrequency);
    drawGraph();
  });
  windowSelect.addEventListener('change', () => {
    s.seconds = Number(windowSelect.value);
    store.set('pitch-trace.seconds', s.seconds);
    drawGraph();
  });
  sensitivity.addEventListener('input', () => {
    s.sensitivity = sliderToThreshold(Number(sensitivity.value));
    store.set('pitch-trace.sensitivity', s.sensitivity);
  });
  rangeButton.addEventListener('click', () => setView('range'));
  octaveButton.addEventListener('click', () => setView('octave'));
  startButton.addEventListener('click', () => running ? stop() : start());
  clearButton.addEventListener('click', () => {
    history.length = 0;
    drawGraph();
  });

  updateScaleSummary();
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);
  onCleanup(() => {
    disposed = true;
    window.removeEventListener('resize', sizeCanvas);
    teardown();
  });
}

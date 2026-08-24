import { el, store, clamp, viewHead } from '../dom.js';

const NOTE_NAMES = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
const A4_OPTIONS = [432, 440, 442, 444];
const HISTORY_MAX = 220;
const SMOOTH_WINDOW = 5;

export function Tuner({ main, onCleanup }) {
  const s = {
    a4: store.get('tuner.a4', 440),
    sens: store.get('tuner.sens', 0.012),
  };

  let ctx = null;
  let analyser = null;
  let stream = null;
  let buf = null;
  let rafId = 0;
  let running = false;
  const history = [];
  const smoothBuf = [];

  main.append(viewHead('Tuner', 'Microphone pitch detection'));

  const errBox = el('div', {
    className: 'panel',
    hidden: true,
    style: 'border-color:rgba(248,113,113,0.4);background:rgba(248,113,113,0.08)',
  });
  const errText = el('div', {});
  errBox.append(errText);

  const noteEl = el('div', { className: 'note' }, '--');
  const hzEl = el('div', { className: 'hz' }, '0.0 Hz');
  const centsEl = el('div', { className: 'cents' }, 'play a note');
  const needle = el('div', { className: 'needle' });
  const meter = el('div', { className: 'meter' }, [
    el('div', { className: 'in-tune' }),
    el('div', { className: 'center' }),
    needle,
  ]);
  const levelBar = el('div', { className: 'bar' }, [el('span')]);
  const levelFill = levelBar.firstChild;

  const canvas = el('canvas', { className: 'graph' });
  const g2d = canvas.getContext('2d');

  main.append(
    errBox,
    el('section', { className: 'panel' }, [
      el('div', { className: 'col' }, [noteEl, hzEl, meter, centsEl]),
      el('div', { className: 'panel-row' }, [el('label', { style: 'min-width:90px' }, 'Input level'), levelBar]),
      el('div', { className: 'col' }, [el('label', {}, 'Pitch history'), canvas]),
    ])
  );

  const a4Select = el('select', { 'aria-label': 'A4 reference frequency' });
  for (const v of A4_OPTIONS) {
    const o = el('option', { value: v }, 'A4 = ' + v + ' Hz');
    if (v === s.a4) o.selected = true;
    a4Select.append(o);
  }

  const sensSlider = el('input', {
    type: 'range',
    min: 1,
    max: 50,
    step: 1,
    value: Math.round(s.sens * 1000),
    'aria-label': 'Microphone sensitivity',
  });

  const startBtn = el('button', { className: 'btn primary big' }, 'Start tuner');

  main.append(
    el('section', { className: 'panel' }, [
      el('div', { className: 'panel-row between' }, [
        el('label', {}, ['A4 reference ', a4Select]),
        startBtn,
      ]),
      el('div', { className: 'panel-row' }, [el('label', { style: 'min-width:90px' }, 'Sensitivity'), sensSlider]),
      el('div', { className: 'muted', style: 'font-size:0.85rem' },
        'Grant microphone access. HTTPS is required by most browsers. Works offline once loaded.'),
    ])
  );

  function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 320;
    const h = canvas.clientHeight || 120;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    g2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGraph();
  }

  function drawGraph() {
    const w = canvas.clientWidth || 320;
    const h = canvas.clientHeight || 120;
    g2d.clearRect(0, 0, w, h);
    g2d.lineWidth = 1;
    g2d.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let i = 1; i <= 3; i++) {
      const y = (h / 4) * i;
      g2d.beginPath();
      g2d.moveTo(0, y);
      g2d.lineTo(w, y);
      g2d.stroke();
    }
    g2d.strokeStyle = 'rgba(74,222,128,0.45)';
    g2d.beginPath();
    g2d.moveTo(0, h / 2);
    g2d.lineTo(w, h / 2);
    g2d.stroke();
    if (history.length < 2) return;
    g2d.strokeStyle = '#22d3ee';
    g2d.lineWidth = 2;
    g2d.beginPath();
    history.forEach((c, i) => {
      const x = (i / (history.length - 1)) * w;
      const y = h / 2 - (clamp(c, -50, 50) / 50) * (h / 2 - 4);
      if (i === 0) g2d.moveTo(x, y);
      else g2d.lineTo(x, y);
    });
    g2d.stroke();
  }

  function showError(msg) {
    errText.textContent = msg;
    errBox.hidden = false;
  }

  function clearError() {
    errBox.hidden = true;
  }

  async function start() {
    clearError();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showError('This browser does not support microphone access.');
      return;
    }
    if (window.isSecureContext === false) {
      showError('Microphone requires HTTPS or localhost.');
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch {}
      }
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const src = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.6;
      src.connect(analyser);
      buf = new Float32Array(analyser.fftSize);
      history.length = 0;
      smoothBuf.length = 0;
      running = true;
      startBtn.textContent = 'Stop tuner';
      startBtn.classList.add('danger');
      detectLoop();
    } catch (err) {
      teardown();
      resetDisplay();
      const messages = {
        NotAllowedError: 'Microphone permission was denied.',
        NotFoundError: 'No microphone was found.',
        NotReadableError: 'The microphone is in use by another app.',
        SecurityError: 'Microphone blocked by browser security settings.',
      };
      showError((err && messages[err.name]) || (err && err.message) || 'Could not start the tuner.');
    }
  }

  function teardown() {
    running = false;
    cancelAnimationFrame(rafId);
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    if (ctx) {
      try { ctx.close(); } catch {}
    }
    ctx = null;
    stream = null;
    analyser = null;
  }

  function resetDisplay() {
    noteEl.textContent = '--';
    hzEl.textContent = '0.0 Hz';
    centsEl.textContent = 'play a note';
    centsEl.className = 'cents';
    needle.style.left = '50%';
    levelFill.style.width = '0%';
    history.length = 0;
    drawGraph();
  }

  function stop() {
    teardown();
    resetDisplay();
    startBtn.textContent = 'Start tuner';
    startBtn.classList.remove('danger');
  }

  function detectLoop() {
    if (!running) return;
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    levelFill.style.width = clamp(Math.round(rms * 300), 0, 100) + '%';
    const freq = rms > s.sens ? autoCorrelate(buf, ctx.sampleRate) : -1;
    update(freq > 20 ? freq : 0);
    rafId = requestAnimationFrame(detectLoop);
  }

  function smoothed(cents) {
    smoothBuf.push(cents);
    if (smoothBuf.length > SMOOTH_WINDOW) smoothBuf.shift();
    const sorted = [...smoothBuf].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  function update(freq) {
    if (!freq) {
      noteEl.textContent = '--';
      hzEl.textContent = '0.0 Hz';
      centsEl.textContent = '\u2014 play a note \u2014';
      centsEl.className = 'cents';
      needle.style.left = '50%';
      history.push(0);
      if (history.length > HISTORY_MAX) history.shift();
      drawGraph();
      return;
    }
    const semitones = 12 * Math.log2(freq / s.a4);
    const rounded = Math.round(semitones);
    const cents = smoothed(clamp((semitones - rounded) * 100, -50, 50));
    history.push(cents);
    if (history.length > HISTORY_MAX) history.shift();

    noteEl.textContent =
      NOTE_NAMES[((rounded % 12) + 12) % 12] + (Math.floor((rounded + 9) / 12) + 4);
    hzEl.textContent = freq.toFixed(2) + ' Hz';
    centsEl.textContent = (cents > 0 ? '+' : '') + Math.round(cents) + ' cents';
    centsEl.className = 'cents ' + (Math.abs(cents) <= 5 ? 'in-tune' : cents > 0 ? 'sharp' : 'flat');
    needle.style.left = 50 + clamp(cents, -50, 50) + '%';
    drawGraph();
  }

  function autoCorrelate(buffer, sampleRate) {
    const size = buffer.length;
    let rms = 0;
    for (let i = 0; i < size; i++) rms += buffer[i] * buffer[i];
    rms = Math.sqrt(rms / size);
    if (rms < 0.005) return -1;

    const minLag = Math.floor(sampleRate / 1200);
    const maxLag = Math.floor(sampleRate / 50);
    const corr = new Float32Array(maxLag + 1);
    let bestLag = -1;
    let bestCorr = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let c = 0;
      for (let i = 0; i < size - lag; i++) c += buffer[i] * buffer[i + lag];
      corr[lag] = c / (size - lag);
      if (corr[lag] > bestCorr) {
        bestCorr = corr[lag];
        bestLag = lag;
      }
    }
    if (bestLag <= 0 || bestCorr < 0.35) return -1;

    const a = corr[bestLag - 1] ?? bestCorr;
    const c = corr[bestLag + 1] ?? bestCorr;
    const denom = a - 2 * bestCorr + c;
    const shift = denom ? (0.5 * (a - c)) / denom : 0;
    return sampleRate / (bestLag + shift);
  }

  a4Select.addEventListener('change', (e) => {
    s.a4 = +e.target.value;
    store.set('tuner.a4', s.a4);
  });

  sensSlider.addEventListener('input', (e) => {
    s.sens = (+e.target.value) / 1000;
    store.set('tuner.sens', s.sens);
  });

  startBtn.addEventListener('click', () => {
    running ? stop() : start();
  });

  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);

  onCleanup(() => {
    window.removeEventListener('resize', sizeCanvas);
    teardown();
  });
}

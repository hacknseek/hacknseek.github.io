import { el, store, clamp, viewHead } from '../dom.js';

const GAP_MS = 2000;

export function TapTempo({ main, onCleanup }) {
  let taps = [];
  let last = 0;
  let pulseTimeout = 0;

  main.append(viewHead('Tap Tempo', 'Tap to find BPM'));

  const bpmValue = el('div', { className: 'big-number' }, '\u2014');
  const useBtn = el('button', { className: 'btn', hidden: true }, 'Use in metronome ↗');
  const detail = el('div', { className: 'muted', style: 'text-align:center' }, 'beats per minute · waiting for your rhythm');
  const tapBtn = el('button', { className: 'tap-pad', 'aria-label': 'Tap the beat' }, [el('span', {}, 'Tap'), el('small', {}, 'OR PRESS SPACE')]);
  const resetBtn = el('button', { className: 'btn ghost' }, 'Reset');

  main.append(
    el('section', { className: 'panel' }, [
      el('div', { className: 'col', style: 'align-items:center;gap:4px' }, [bpmValue, detail]),
      el('div', { className: 'panel-row', style: 'justify-content:center;gap:14px' }, [tapBtn]),
      el('div', { className: 'panel-row', style: 'justify-content:center' }, [resetBtn, useBtn]),
      el('div', { className: 'muted', style: 'text-align:center;font-size:12px' },
        'Tap the button or press Space. Three or more taps in rhythm gives a stable reading.'),
    ])
  );

  function tap() {
    tapBtn.classList.add('is-tapped');
    clearTimeout(pulseTimeout);
    pulseTimeout = setTimeout(() => tapBtn.classList.remove('is-tapped'), 100);
    const now = performance.now();
    if (last && now - last > GAP_MS) taps = [];
    if (last && now - last < 80) return;
    taps.push(now);
    if (taps.length > 32) taps.shift();
    last = now;
    if (taps.length < 2) {
      useBtn.hidden = true;
      bpmValue.textContent = '\u2014';
      detail.textContent = 'keep tapping\u2026';
      return;
    }
    const intervals = [];
    for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1]);
    intervals.sort((a, b) => a - b);
    const trim = Math.floor(intervals.length / 4);
    const middle = intervals.slice(trim, intervals.length - trim);
    const pool = middle.length ? middle : intervals;
    const avg = pool.reduce((sum, v) => sum + v, 0) / pool.length;
    bpmValue.textContent = String(Math.round(60000 / avg));
    useBtn.hidden = false;
    detail.textContent = `${taps.length} taps \u00b7 avg ${(avg / 1000).toFixed(2)}s`;
  }

  function reset() {
    taps = [];
    last = 0;
    useBtn.hidden = true;
    bpmValue.textContent = '\u2014';
    detail.textContent = 'beats per minute · waiting for your rhythm';
  }

  useBtn.addEventListener('click', () => {
    store.set('metro.bpm', clamp(Number(bpmValue.textContent), 30, 260));
    location.hash = '#metronome';
  });

  tapBtn.addEventListener('click', () => { tap(); tapBtn.blur(); });
  resetBtn.addEventListener('click', () => { reset(); resetBtn.blur(); });

  function onKey(e) {
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.target?.isContentEditable || /^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(e.target?.tagName)) return;
    if (e.code === 'Space') {
      e.preventDefault();
      tap();
    } else if (e.key === 'r' || e.key === 'R') {
      reset();
    }
  }
  document.addEventListener('keydown', onKey);

  onCleanup(() => { document.removeEventListener('keydown', onKey); clearTimeout(pulseTimeout); });
}

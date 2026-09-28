import { el, store, clamp, viewHead } from '../dom.js';

const SVG = 'http://www.w3.org/2000/svg';
const ROUNDS = 100;
const RUNS = 100;
const percent = (value) => `${(value * 100).toFixed(1).replace(/\.0$/, '')}%`;
const signed = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
const compact = (value) => `${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}%`;

export function kellyFraction(p, b) {
  return clamp((b * p - (1 - p)) / b, 0, 1);
}

export function geometricGrowth(p, b, f) {
  return 100 * Math.expm1(p * Math.log1p(b * f) + (1 - p) * Math.log1p(-f));
}

export function simulateKelly(p, b, f, seed, runs = RUNS, rounds = ROUNDS) {
  let randomState = seed >>> 0;
  const random = () => {
    randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  return Array.from({ length: runs }, () => {
    let wealth = 1;
    const path = [0];
    for (let round = 1; round <= rounds; round++) {
      wealth *= random() < p ? 1 + b * f : 1 - f;
      path.push((wealth - 1) * 100);
    }
    return path;
  });
}

function chartFrame(width, height, bottom = 46) {
  return { left: 64, top: 38, right: width - 14, bottom: height - bottom };
}

function axis(label, vertical, ticks, scale, frame) {
  return ticks.map((value) => vertical
    ? `<g><line x1="${frame.left}" x2="${frame.right}" y1="${scale(value).toFixed(1)}" y2="${scale(value).toFixed(1)}" class="kelly-grid"/><text x="${frame.left - 9}" y="${(scale(value) + 4).toFixed(1)}" text-anchor="end">${label(value)}</text></g>`
    : `<text x="${scale(value).toFixed(1)}" y="${frame.bottom + 20}" text-anchor="middle">${label(value)}</text>`).join('');
}

function scale(lo, hi, start, end) {
  return (value) => start + (value - lo) / (hi - lo) * (end - start);
}

function plotGrowth(node, p, b, f) {
  const width = Math.max(280, Math.round(node.getBoundingClientRect().width));
  const height = 275;
  const frame = chartFrame(width, height);
  const best = kellyFraction(p, b);
  const maxF = Math.min(.99, Math.max(.4, best * 2, f + .08));
  const points = Array.from({ length: 241 }, (_, i) => {
    const fraction = maxF * i / 240;
    return [fraction, geometricGrowth(p, b, fraction)];
  });
  const ys = points.map((point) => point[1]);
  const lo = Math.min(0, ...ys);
  const hi = Math.max(0, ...ys);
  const pad = Math.max(.25, (hi - lo) * .12);
  const x = scale(0, maxF, frame.left + 6, frame.right - 6);
  const y = scale(lo - pad, hi + pad, frame.bottom - 6, frame.top + 6);
  const d = points.map(([fraction, growth], i) => `${i ? 'L' : 'M'}${x(fraction).toFixed(1)} ${y(growth).toFixed(1)}`).join('');
  const yTicks = Array.from({ length: 5 }, (_, i) => lo - pad + (hi - lo + 2 * pad) * i / 4);
  node.innerHTML = `<svg xmlns="${SVG}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Geometric growth by stake fraction. Kelly optimum ${percent(best)}; selected stake ${percent(f)} grows ${signed(geometricGrowth(p, b, f))} per round.">
    <text x="${frame.left}" y="18" class="kelly-axis-title">GEOMETRIC GROWTH PER ROUND</text>
    ${axis((v) => `${v.toFixed(Math.abs(v) < 10 ? 1 : 0)}%`, true, yTicks, y, frame)}
    <line x1="${frame.left}" x2="${frame.right}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="kelly-zero"/>
    <rect x="${frame.left}" y="${frame.top}" width="${frame.right - frame.left}" height="${frame.bottom - frame.top}" class="kelly-frame"/>
    <path d="${d}" class="kelly-growth-line"/>
    <line x1="${x(best).toFixed(1)}" x2="${x(best).toFixed(1)}" y1="${frame.top}" y2="${frame.bottom}" class="kelly-optimum-line"/>
    <path d="M${x(best).toFixed(1)} ${(y(geometricGrowth(p, b, best)) - 6).toFixed(1)}l6 6-6 6-6-6z" class="kelly-optimum-mark"/>
    <circle cx="${x(f).toFixed(1)}" cy="${y(geometricGrowth(p, b, f)).toFixed(1)}" r="4.5" class="kelly-selected-mark"/>
    ${axis((v) => `${(v * 100).toFixed(0)}%`, false, [0, maxF / 4, maxF / 2, maxF * 3 / 4, maxF], x, frame)}
    <text x="${(frame.left + frame.right) / 2}" y="${height - 8}" text-anchor="middle" class="kelly-axis-title">STAKE AS % OF CURRENT BANKROLL</text>
  </svg>`;
}

function plotSimulations(node, paths) {
  const width = Math.max(280, Math.round(node.getBoundingClientRect().width));
  const height = 300;
  const frame = chartFrame(width, height);
  let lo = 0, hi = 0;
  const logBankroll = (returnPercent) => Math.log1p(returnPercent / 100);
  for (const path of paths) for (const value of path) {
    const logged = logBankroll(value);
    lo = Math.min(lo, logged);
    hi = Math.max(hi, logged);
  }
  const pad = Math.max(.15, (hi - lo) * .08);
  const x = scale(0, ROUNDS, frame.left + 6, frame.right - 6);
  const y = scale(lo - pad, hi + pad, frame.bottom - 6, frame.top + 6);
  const yTicks = Array.from({ length: 5 }, (_, i) => lo - pad + (hi - lo + 2 * pad) * i / 4);
  const lines = paths.map((path) => `<path class="kelly-sim-line" d="${path.map((value, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(logBankroll(value)).toFixed(1)}`).join('')}"/>`).join('');
  node.innerHTML = `<svg xmlns="${SVG}" viewBox="0 0 ${width} ${height}" role="img" aria-label="One hundred independent simulations, one hundred rounds each, showing cumulative profit or loss relative to initial bankroll on a log bankroll scale.">
    <text x="${frame.left}" y="18" class="kelly-axis-title">CUMULATIVE RETURN · LOG BANKROLL SCALE</text>
    ${axis((v) => compact(100 * Math.expm1(v)), true, yTicks, y, frame)}
    <line x1="${frame.left}" x2="${frame.right}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="kelly-zero"/>
    <rect x="${frame.left}" y="${frame.top}" width="${frame.right - frame.left}" height="${frame.bottom - frame.top}" class="kelly-frame"/>
    <g class="kelly-sim-lines">${lines}</g>
    ${axis((v) => String(v), false, [0, 25, 50, 75, 100], x, frame)}
    <text x="${(frame.left + frame.right) / 2}" y="${height - 8}" text-anchor="middle" class="kelly-axis-title">ROUNDS</text>
  </svg>`;
}

export function KellyLab({ main, onCleanup }) {
  const saved = store.get('kelly.settings', {});
  const state = {
    p: clamp(Number.isFinite(saved.p) ? saved.p : .6, .05, .95),
    b: clamp(Number.isFinite(saved.b) ? saved.b : 1, .25, 5),
    f: clamp(Number.isFinite(saved.f) ? saved.f : .2, 0, .95),
    seed: Number.isInteger(saved.seed) ? saved.seed >>> 0 : Math.floor(Math.random() * 4294967296),
  };
  main.append(viewHead('Kelly Lab', 'Stake sizing and probability'));

  function slider(label, min, max, step, value, id) {
    const input = el('input', { id, type: 'range', min, max, step, value, className: 'kelly-slider' });
    const output = el('output', { htmlFor: id, className: 'kelly-control-value' });
    const control = el('label', { className: 'kelly-control', htmlFor: id }, [
      el('span', { className: 'kelly-control-header' }, [el('span', {}, label), output]), input,
    ]);
    return { control, input, output };
  }
  const chance = slider('Win probability', 5, 95, 1, state.p * 100, 'kelly-p');
  const odds = slider('Net profit per $1 won', .25, 5, .05, state.b, 'kelly-b');
  const stake = slider('Stake per round', 0, 95, 'any', state.f * 100, 'kelly-f');
  const controls = el('section', { className: 'kelly-controls', 'aria-label': 'Simulation parameters' }, [chance.control, odds.control, stake.control]);
  const full = el('button', { className: 'btn', type: 'button' }, 'Full Kelly');
  const half = el('button', { className: 'btn', type: 'button' }, 'Half Kelly');
  const presets = el('div', { className: 'kelly-actions' }, [full, half]);
  const growthPlot = el('div', { className: 'kelly-chart', 'data-kelly-chart': 'growth' });
  const simPlot = el('div', { className: 'kelly-chart', 'data-kelly-chart': 'simulations' });
  const growthResult = el('p', { className: 'kelly-result', role: 'status', 'aria-live': 'polite' });
  const simResult = el('p', { className: 'kelly-result', role: 'status', 'aria-live': 'polite' });
  const rerun = el('button', { className: 'btn', type: 'button' }, 'Run 100 new paths');
  main.append(
    el('p', { className: 'kelly-intro' }, 'Explore the fraction that maximizes long-run compounded growth, then see how uncertain the next 100 rounds can be.'),
    controls, presets,
    el('section', { className: 'kelly-section' }, [el('h3', {}, 'Long-run growth'), growthResult, growthPlot]),
    el('section', { className: 'kelly-section' }, [el('div', { className: 'kelly-section-head' }, [el('h3', {}, '100 paths · 100 rounds each'), rerun]), simResult, simPlot]),
    el('p', { className: 'kelly-note' }, 'Each round risks the selected fraction of the current bankroll. A win earns the net odds; a loss loses the stake. The simulation uses a log bankroll scale so paths with very different returns remain visible. These independent paths are not a forecast.'),
  );

  let disposed = false;
  let scheduled = 0;
  function persist() { store.set('kelly.settings', state); }
  function draw() {
    if (disposed) return;
    chance.input.value = state.p * 100;
    odds.input.value = state.b;
    stake.input.value = state.f * 100;
    chance.output.textContent = percent(state.p);
    odds.output.textContent = `${state.b.toFixed(2)}×`;
    stake.output.textContent = percent(state.f);
    const best = kellyFraction(state.p, state.b);
    growthResult.textContent = `◆ Kelly fraction ${percent(best)}  ·  ● Selected fraction ${percent(state.f)}  ·  Geometric growth ${signed(geometricGrowth(state.p, state.b, state.f))} per round`;
    plotGrowth(growthPlot, state.p, state.b, state.f);
    const paths = simulateKelly(state.p, state.b, state.f, state.seed);
    const final = paths.map((path) => path[ROUNDS]).sort((a, b) => a - b);
    simResult.textContent = `Median ending return ${compact((final[49] + final[50]) / 2)} across 100 runs`;
    plotSimulations(simPlot, paths);
  }
  function schedule() {
    if (!scheduled) scheduled = requestAnimationFrame(() => { scheduled = 0; draw(); });
  }
  for (const [control, key, divisor] of [[chance, 'p', 100], [odds, 'b', 1], [stake, 'f', 100]]) {
    control.input.addEventListener('input', () => {
      state[key] = Number(control.input.value) / divisor;
      persist();
      schedule();
    });
  }
  full.addEventListener('click', () => { state.f = kellyFraction(state.p, state.b); persist(); schedule(); });
  half.addEventListener('click', () => { state.f = kellyFraction(state.p, state.b) / 2; persist(); schedule(); });
  rerun.addEventListener('click', () => { state.seed = Math.floor(Math.random() * 4294967296); persist(); schedule(); });
  const observer = new ResizeObserver(schedule);
  observer.observe(growthPlot);
  observer.observe(simPlot);
  onCleanup(() => { disposed = true; observer.disconnect(); cancelAnimationFrame(scheduled); });
  draw();
}

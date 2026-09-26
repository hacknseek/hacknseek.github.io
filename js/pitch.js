import { clamp } from './dom.js';

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function frequencyToMidi(frequency, a4 = 440) {
  return 69 + 12 * Math.log2(frequency / a4);
}

export function midiNote(midi) {
  const rounded = Math.round(midi);
  return {
    midi: rounded,
    name: NOTE_NAMES[((rounded % 12) + 12) % 12],
    octave: Math.floor(rounded / 12) - 1,
    cents: (midi - rounded) * 100,
  };
}

export function autoCorrelate(buffer, sampleRate) {
  const size = buffer.length;
  let mean = 0;
  for (let i = 0; i < size; i++) mean += buffer[i];
  mean /= size;

  const sig = new Float32Array(size);
  let rms = 0;
  for (let i = 0; i < size; i++) {
    const v = buffer[i] - mean;
    sig[i] = v;
    rms += v * v;
  }
  rms = Math.sqrt(rms / size);
  const energy = rms * rms;
  if (energy < 1e-9) return -1;

  const minLag = Math.floor(sampleRate / 1200);
  const maxLag = Math.floor(sampleRate / 50);
  const corr = new Float32Array(maxLag + 1);
  let bestLag = -1;
  let bestCorr = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let c = 0;
    for (let i = 0; i < size - lag; i++) c += sig[i] * sig[i + lag];
    corr[lag] = c / (size - lag);
    if (corr[lag] > bestCorr) {
      bestCorr = corr[lag];
      bestLag = lag;
    }
  }
  if (bestLag <= 0 || bestCorr / energy < 0.5) return -1;

  const cutoff = bestCorr * 0.9;
  let state = 0;
  let peak = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (state === 0) {
      if (corr[lag] < cutoff) state = 1;
    } else if (corr[lag] >= cutoff) {
      peak = lag;
      break;
    }
  }
  if (peak === -1 || corr[peak] / energy < 0.35) return -1;
  while (peak + 1 <= maxLag && corr[peak + 1] > corr[peak]) peak++;
  bestLag = peak;

  // Normalize the three samples around the peak before interpolation. This
  // avoids phase-dependent pitch drift from the finite sample window.
  function normalizedCorrelation(lag) {
    let product = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;
    for (let i = 0; i < size - lag; i++) {
      product += sig[i] * sig[i + lag];
      leftEnergy += sig[i] * sig[i];
      rightEnergy += sig[i + lag] * sig[i + lag];
    }
    return product / Math.sqrt(leftEnergy * rightEnergy || 1);
  }
  const a = normalizedCorrelation(bestLag - 1);
  const b = normalizedCorrelation(bestLag);
  const c = normalizedCorrelation(bestLag + 1);
  const denom = a - 2 * b + c;
  const shift = denom ? clamp(0.5 * (a - c) / denom, -1, 1) : 0;
  return sampleRate / (bestLag + shift);
}

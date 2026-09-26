import { icons } from './icons.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('aria-') || key.startsWith('data-') || key === 'role' || key === 'for') node.setAttribute(key, value);
    else node[key] = value;
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(child));
  }
  return node;
}

export const store = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem('hns:' + key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('hns:' + key, JSON.stringify(value));
    } catch {}
  },
};

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const fmtTime = (sec) => {
  sec = clamp(Math.round(sec), 0, 359999);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

let toastTimer = 0;
export function toast(msg, ms = 1800) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

export function viewHead(title, crumbs) {
  return el('div', { className: 'view-head' }, [
    el('a', { className: 'icon-btn', href: '#/', 'aria-label': 'Back to hub', innerHTML: icons.back }),
    el('h2', {}, title),
    crumbs ? el('span', { className: 'crumbs' }, crumbs) : null,
  ]);
}

export function audioContext() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error('Web Audio is not supported in this browser.');
  return new AC();
}

function waitForAudioAction(action, timeout) {
  let timer = 0;
  return Promise.race([
    Promise.resolve(action),
    new Promise((resolve) => { timer = setTimeout(resolve, timeout); }),
  ]).finally(() => clearTimeout(timer));
}

// iOS can leave Web Audio suspended or in its non-standard "interrupted"
// state after the screen locks or the PWA moves to the background. Never wait
// forever for resume(): some WebKit versions leave its promise pending.
export async function resumeAudioContext(ctx, { restart = false, timeout = 1000 } = {}) {
  if (!ctx || ctx.state === 'closed') return false;
  try {
    if (restart && ctx.state === 'running') {
      await waitForAudioAction(ctx.suspend(), timeout);
      if (ctx.state === 'running') return false;
    }
    if (ctx.state !== 'running') await waitForAudioAction(ctx.resume(), timeout);
  } catch {}
  return ctx.state === 'running';
}

export async function suspendAudioContext(ctx, timeout = 1000) {
  if (!ctx || ctx.state === 'closed' || ctx.state === 'suspended') return true;
  try { await waitForAudioAction(ctx.suspend(), timeout); } catch {}
  return ctx.state === 'suspended' || ctx.state === 'interrupted';
}

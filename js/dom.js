import { icons } from './icons.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, attrs = {}, children = []) {
  const node = Object.assign(document.createElement(tag), attrs);
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

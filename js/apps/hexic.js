import { el, store, viewHead } from '../dom.js';

const ROWS = 8;
const COLS = 7;
const N_COLORS = 6;
const COLORS = ['#f87171', '#4ade80', '#60a5fa', '#fbbf24', '#c084fc', '#fb923c'];
const COLOR_NAMES = ['red', 'green', 'blue', 'yellow', 'purple', 'orange'];
const HEX_DIRS = [
  [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]],
  [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]],
];
const EMPTY = -1;

function hexCorner(cx, cy, r, i) {
  const a = (Math.PI / 180) * (60 * i - 30);
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

export function Hexic({ main, onCleanup }) {
  let grid = [];
  let score = store.get('hexic.best', 0);
  let best = score;
  let sel = null;
  let anim = null;
  let dropping = false;
  let over = false;
  let particles = [];
  let hintId = 0;
  let combo = 0;

  const R = 28;
  const RR = R - 3;
  const CW = R * 2;
  const CH = R * Math.sqrt(3);
  const BORDER = 12;
  const BW = COLS * CW + BORDER * 2;
  const BH = ROWS * CH + BORDER * 2 + CH * 0.4;

  const root = main;
  root.append(viewHead('Hexic', 'Match-3 hex puzzle'));

  function initGrid() {
    grid = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) {
        row.push({ r, c, color: EMPTY, px: 0, py: 0, baseY: 0, vx: 0, vy: 0 });
      }
      grid.push(row);
    }
  }

  const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
  const get = (r, c) => (inBounds(r, c) ? grid[r][c] : null);
  const set = (r, c, color) => { if (inBounds(r, c)) grid[r][c].color = color; };

  function hexX(r, c) {
    return BORDER + R + c * CW + (r & 1) * R;
  }

  function hexY(r, _c) {
    return BORDER + R + r * CH;
  }

  function neighbors(r, c) {
    const dirs = r & 1 ? HEX_DIRS[0] : HEX_DIRS[1];
    return dirs.map(([dr, dc]) => [r + dr, c + dc]).filter(([nr, nc]) => inBounds(nr, nc));
  }

  function pixelToHex(px, py) {
    let best = null, bestD = Infinity;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const hx = hexX(r, c), hy = grid[r][c].baseY;
        const dx = px - hx, dy = py - hy;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = { r, c }; }
      }
    }
    return bestD < RR * RR * 1.2 ? best : null;
  }

  function findMatchedTrails() {
    const m = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    let any = false;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const col = grid[r][c].color;
        if (col === EMPTY) continue;
        for (let d = 0; d < 6; d++) {
          const dirs = r & 1 ? HEX_DIRS[0] : HEX_DIRS[1];
          const [dr, dc] = dirs[d];
          let cr = r, cc = c;
          let trail = [];
          while (true) {
            const nr = cr + dr, nc = cc + dc;
            if (!inBounds(nr, nc) || grid[nr][nc].color !== col) break;
            cr = nr; cc = nc;
            trail.push(grid[cr][cc]);
          }
          if (trail.length >= 2) {
            any = true;
            m[r][c] = true;
            for (const cell of trail) m[cell.r][cell.c] = true;
          }
        }
      }
    }
    return { m, any };
  }

  function clearMatched() {
    const { m, any } = findMatchedTrails();
    if (!any) return false;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!m[r][c]) continue;
        const hx = hexX(r, c);
        for (let i = 0; i < 6; i++) {
          particles.push({
            x: hx, y: grid[r][c].baseY,
            vx: (Math.random() - 0.5) * 140,
            vy: (Math.random() - 0.5) * 140 - 40,
            life: 1, color: COLORS[grid[r][c].color], size: 3 + Math.random() * 4,
          });
        }
        set(r, c, EMPTY);
      }
    }
    combo++;
    score += 10 * combo;
    if (score > best) { best = score; store.set('hexic.best', best); }
    updateHUD();
    return true;
  }

  function drop() {
    dropping = true;
    let moved = false;
    for (let c = 0; c < COLS; c++) {
      for (let r = ROWS - 1; r >= 0; r--) {
        if (grid[r][c].color !== EMPTY) continue;
        for (let r2 = r - 1; r2 >= 0; r2--) {
          if (grid[r2][c].color === EMPTY) continue;
          grid[r][c].color = grid[r2][c].color;
          grid[r2][c].color = EMPTY;
          grid[r][c].baseY = hexY(r2, c);
          grid[r][c].py = grid[r][c].baseY - hexY(r, c);
          grid[r][c].vy = 0;
          grid[r][c].vx = 0;
          moved = true;
          break;
        }
      }
    }
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (grid[r][c].color !== EMPTY && grid[r][c].py !== 0) {
          const ty = hexY(r, c);
          const dist = -grid[r][c].py;
          grid[r][c].vy = dist / 10;
          grid[r][c].baseY = ty;
          moved = true;
        } else if (grid[r][c].color !== EMPTY) {
          grid[r][c].py = 0;
          grid[r][c].baseY = hexY(r, c);
        }
      }
    }
    if (!moved) dropping = false;
    return moved;
  }

  function fillTop() {
    let filled = false;
    for (let c = 0; c < COLS; c++) {
      let empty = 0;
      for (let r = 0; r < ROWS; r++) if (grid[r][c].color === EMPTY) empty++;
      let y = 0;
      for (let r = 0; r < ROWS; r++) {
        if (grid[r][c].color !== EMPTY) continue;
        let cl;
        do { cl = Math.floor(Math.random() * N_COLORS); } while (false);
        set(r, c, cl);
        grid[r][c].baseY = hexY(-1 - y, c);
        grid[r][c].py = grid[r][c].baseY - hexY(r, c);
        grid[r][c].vy = 0;
        y++;
        filled = true;
      }
    }
    return filled;
  }

  function isAnimating() {
    if (anim) return true;
    if (dropping) return true;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c].py !== 0 || grid[r][c].vy !== 0) return true;
      }
    }
    return false;
  }

  function hasValidMoves() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        for (const [nr, nc] of neighbors(r, c)) {
          if (nr < r || (nr === r && nc <= c)) continue;
          const a = grid[r][c].color, b = grid[nr][nc].color;
          if (a === b) continue;
          if (a === EMPTY || b === EMPTY) continue;
          grid[r][c].color = b; grid[nr][nc].color = a;
          const { any } = findMatchedTrails();
          grid[r][c].color = a; grid[nr][nc].color = b;
          if (any) return true;
        }
      }
    }
    return false;
  }

  function processStep() {
    if (isAnimating()) return;
    const hadMatch = clearMatched();
    if (hadMatch) {
      drop(); fillTop();
      setTimeout(processStep, 200);
      return;
    }
    combo = 0;
    if (!hasValidMoves()) {
      over = true;
      updateHUD();
    }
  }

  function startSwap(r1, c1, r2, c2, commit) {
    anim = { r1, c1, r2, c2, t: 0, dur: 130, commit };
  }

  function doSwap(r1, c1, r2, c2) {
    const tmp = grid[r1][c1].color;
    grid[r1][c1].color = grid[r2][c2].color;
    grid[r2][c2].color = tmp;
  }

  function onPointerDown(e) {
    if (over || anim || dropping) return;
    const rect = canvas.getBoundingClientRect();
    const k = BW / rect.width;
    const px = (e.clientX - rect.left) * k;
    const py = (e.clientY - rect.top) * k;
    const h = pixelToHex(px, py);
    if (!h) return;

    if (!sel) {
      sel = h;
      return;
    }
    if (h.r === sel.r && h.c === sel.c) {
      sel = null;
      return;
    }
    const adj = neighbors(sel.r, sel.c).some(([nr, nc]) => nr === h.r && nc === h.c);
    if (!adj) {
      sel = h;
      return;
    }
    const r1 = sel.r, c1 = sel.c, r2 = h.r, c2 = h.c;
    doSwap(r1, c1, r2, c2);
    const { any } = findMatchedTrails();
    if (any) {
      startSwap(r1, c1, r2, c2, true);
    } else {
      doSwap(r1, c1, r2, c2);
      startSwap(r1, c1, r2, c2, false);
    }
    sel = null;
  }

  const canvas = el('canvas', { className: 'hexic-board' });
  const hud = el('div', { className: 'panel-row between' });
  const scoreEl = el('span', { className: 'big-number', style: 'font-size:1.6rem' }, '0');
  const bestEl = el('span', { className: 'muted' }, 'Best: ' + best);
  hud.append(scoreEl, bestEl);

  const resetBtn = el('button', { className: 'btn' }, 'New game');

  const boardWrap = el('div', { className: 'hexic-wrap' }, [canvas]);
  root.append(boardWrap, hud, resetBtn,
    el('div', { className: 'muted', style: 'font-size:0.85rem' },
      'Tap a piece, then tap an adjacent piece to swap. Match 3+ in a row to clear.')
  );

  let ctx2d;
  function sizeCanvas() {
    const dpr = devicePixelRatio || 1;
    const cw = canvas.clientWidth || BW;
    const scale = Math.min((cw - 20) / BW, 1);
    const w = Math.round(BW * scale);
    const h = Math.round(BH * scale);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.height = h + 'px';
    ctx2d = canvas.getContext('2d');
    ctx2d.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    draw();
  }

  function drawHex(cx, cy, r, fill, stroke, shadow) {
    if (shadow) {
      ctx2d.shadowColor = shadow;
      ctx2d.shadowBlur = 10;
    }
    ctx2d.beginPath();
    for (let i = 0; i < 6; i++) {
      const [x, y] = hexCorner(cx, cy, r, i);
      i === 0 ? ctx2d.moveTo(x, y) : ctx2d.lineTo(x, y);
    }
    ctx2d.closePath();
    if (fill) { ctx2d.fillStyle = fill; ctx2d.fill(); }
    if (stroke) { ctx2d.strokeStyle = stroke; ctx2d.lineWidth = 1; ctx2d.stroke(); }
    ctx2d.shadowColor = 'transparent';
    ctx2d.shadowBlur = 0;
  }

  function draw() {
    if (!ctx2d) return;
    const w = canvas.width / (devicePixelRatio || 1);
    const h = canvas.height / (devicePixelRatio || 1);
    ctx2d.clearRect(0, 0, w, h);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = grid[r][c];
        const hx = hexX(r, c) + (cell.px || 0);
        const hy = cell.baseY + cell.py;
        drawHex(hx, hy, R, 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.1)');
      }
    }

    if (sel) {
      const sx = hexX(sel.r, sel.c) + (grid[sel.r][sel.c].px || 0);
      const sy = grid[sel.r][sel.c].baseY + grid[sel.r][sel.c].py;
      ctx2d.strokeStyle = '#22d3ee';
      ctx2d.lineWidth = 3;
      drawHex(sx, sy, R + 3, null, '#22d3ee');
      drawHex(sx, sy, R + 3, null, '#22d3ee');
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = grid[r][c];
        if (cell.color === EMPTY) continue;
        const hx = hexX(r, c) + (cell.px || 0);
        const hy = cell.baseY + cell.py;
        if (hy < -R || hy > BH + R) continue;
        const color = COLORS[cell.color];

        ctx2d.globalAlpha = 1;
        ctx2d.beginPath();
        ctx2d.arc(hx, hy, RR, 0, Math.PI * 2);
        ctx2d.fillStyle = color;
        ctx2d.shadowColor = color;
        ctx2d.shadowBlur = cell.matched ? 14 : 5;
        ctx2d.fill();
        ctx2d.shadowColor = 'transparent';
        ctx2d.shadowBlur = 0;

        ctx2d.beginPath();
        ctx2d.arc(hx - RR * 0.25, hy - RR * 0.2, RR * 0.28, 0, Math.PI * 2);
        ctx2d.fillStyle = 'rgba(255,255,255,0.22)';
        ctx2d.fill();
        ctx2d.globalAlpha = 1;
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      ctx2d.globalAlpha = p.life * 0.8;
      ctx2d.beginPath();
      ctx2d.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx2d.fillStyle = p.color;
      ctx2d.fill();
    }
    ctx2d.globalAlpha = 1;

    if (over) {
      ctx2d.fillStyle = 'rgba(11,13,18,0.82)';
      ctx2d.fillRect(0, 0, w, h);
      ctx2d.fillStyle = '#e7ecf3';
      ctx2d.font = '700 30px ui-sans-serif, system-ui, sans-serif';
      ctx2d.textAlign = 'center';
      ctx2d.fillText('Game Over', w / 2, h / 2 - 14);
      ctx2d.font = '500 16px ui-sans-serif, system-ui, sans-serif';
      ctx2d.fillStyle = '#9aa3b2';
      ctx2d.fillText('Score: ' + score, w / 2, h / 2 + 14);
    }
  }

  function updateHUD() {
    scoreEl.textContent = String(score);
    bestEl.textContent = 'Best: ' + best;
  }

  let lastTime = 0;
  function tick(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (anim) {
      anim.t += dt * 1000;
      const p = Math.min(anim.t / anim.dur, 1);
      const ease = p * (2 - p);
      const a = grid[anim.r1][anim.c1], b = grid[anim.r2][anim.c2];
      const dx = hexX(anim.r2, anim.c2) - hexX(anim.r1, anim.c1);
      const dy = b.baseY - a.baseY;
      a.px = dx * ease; a.py = dy * ease;
      b.px = -dx * ease; b.py = -dy * ease;
      if (anim.t >= anim.dur) {
        a.px = 0; a.py = 0; a.vx = 0; a.vy = 0;
        b.px = 0; b.py = 0; b.vx = 0; b.vy = 0;
        anim = null;
        processStep();
      }
    }

    if (!anim) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = grid[r][c];
          if (cell.vy !== 0 || cell.py !== 0) {
            cell.vy += 3800 * dt;
            cell.py += cell.vy * dt;
            if (cell.py >= 0) {
              cell.py = 0;
              cell.vy = 0;
              cell.vx = 0;
            }
          }
        }
      }
    }

    if (!anim && dropping) {
      let anyMoving = false;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (grid[r][c].py !== 0 || grid[r][c].vy !== 0) { anyMoving = true; break; }
        }
        if (anyMoving) break;
      }
      if (!anyMoving) {
        dropping = false;
        processStep();
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 2.8;
      if (p.life <= 0) particles.splice(i, 1);
    }

    draw();
    rafId = requestAnimationFrame(tick);
  }

  function startGame() {
    initGrid();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        let col;
        let ok = false;
        while (!ok) {
          col = Math.floor(Math.random() * N_COLORS);
          let dup = false;
          for (const [nr, nc] of neighbors(r, c)) {
            if (nr < r || (nr === r && nc < c)) continue;
            if (grid[nr][nc].color === col) { dup = true; break; }
          }
          if (!dup || neighbors(r, c).every(([nr, nc]) => !inBounds(nr, nc) || grid[nr][nc].color === EMPTY)) {
            ok = true;
          }
        }
        set(r, c, col);
        grid[r][c].baseY = hexY(r, c);
      }
    }
    score = 0; over = false; combo = 0;
    sel = null; anim = null; dropping = false; particles = [];
    updateHUD();
    sizeCanvas();
  }

  resetBtn.addEventListener('click', () => { startGame(); resetBtn.blur(); });

  canvas.addEventListener('pointerdown', onPointerDown);

  let rafId = 0;
  function start() { lastTime = performance.now(); rafId = requestAnimationFrame(tick); }
  startGame();
  sizeCanvas();
  start();
  window.addEventListener('resize', sizeCanvas);

  onCleanup(() => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', sizeCanvas);
  });
}

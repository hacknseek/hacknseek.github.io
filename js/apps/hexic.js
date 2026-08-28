import { el, store, viewHead, toast } from '../dom.js';

// Hexic is played on a pointy-top axial hex grid. A normal move rotates the
// three hexes which meet at one vertex; it never swaps a pair of tiles.
// The original layout is a compact, square staggered honeycomb.
// Rows are offset by half a cell; they are not cumulatively shifted into
// a rhombus. This keeps the playfield close to the classic square silhouette.
const ROWS = 8;
const COLS = 8;
const N_COLORS = 6;
const COLORS = ['#f87171', '#4ade80', '#60a5fa', '#fbbf24', '#c084fc', '#fb923c'];
const EMPTY = null;

const SQRT3 = Math.sqrt(3);

function hexCorner(cx, cy, r, i) {
  const a = (Math.PI / 180) * (30 + 60 * i);
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

export function Hexic({ main, onCleanup }) {
  let grid = [];
  let score = 0;
  let best = store.get('hexic.best', 0);
  let moves = 0;
  let combo = 0;
  let focused = { r: 0, c: 0 };
  let selected = null;
  let animation = null;
  let dropAnimation = null;
  let particles = [];
  let over = false;
  let hint = null;
  let turnRunning = false;
  let pearlPattern = 0;
  let rafId = 0;
  let lastTime = 0;

  const R = 28;
  const BORDER = 18;
  const STEP_X = SQRT3 * R;
  const STEP_Y = R * 1.5;
  const ROW_OFFSET_X = STEP_X / 2;
  const BW = BORDER * 2 + R * 2 + STEP_X * (COLS - 1) + ROW_OFFSET_X;
  const BH = BORDER * 2 + R * 2 + STEP_Y * (ROWS - 1);

  const root = main;
  root.append(viewHead('Hexic', 'Rotate groups of three · flowers and pearls'));

  const canvas = el('canvas', {
    className: 'hexic-board',
    tabIndex: 0,
    role: 'application',
  });
  canvas.setAttribute(
    'aria-label',
    'Hexic game board. Select a shared corner of three hexagons, then rotate clockwise or counterclockwise.'
  );

  const scoreEl = el('span', { className: 'big-number', style: 'font-size:1.6rem' }, '0');
  const bestEl = el('span', { className: 'muted' }, 'Best: ' + best);
  const movesEl = el('span', { className: 'muted' }, 'Moves: 0');
  const bombEl = el('span', { className: 'muted' }, 'Bombs: none');
  const statusEl = el('div', { className: 'hexic-status muted', role: 'status', 'aria-live': 'polite' },
    'Select a shared corner between three tiles.'
  );

  const rotateCcwBtn = el('button', { className: 'btn', disabled: true }, '↺ Rotate');
  const rotateCwBtn = el('button', { className: 'btn', disabled: true }, 'Rotate ↻');
  const pearlBtn = el('button', { className: 'btn ghost', disabled: true, hidden: true }, 'Y pattern');
  const hintBtn = el('button', { className: 'btn ghost' }, 'Hint');
  const resetBtn = el('button', { className: 'btn' }, 'New game');

  const hud = el('div', { className: 'panel-row between hexic-hud' }, [
    el('span', { className: 'big-number', style: 'font-size:1.6rem' }, [scoreEl]),
    el('div', { className: 'col hexic-stats' }, [bestEl, movesEl, bombEl]),
  ]);
  const controls = el('div', { className: 'row hexic-controls' }, [
    rotateCcwBtn, rotateCwBtn, pearlBtn,
  ]);
  const boardWrap = el('div', { className: 'hexic-wrap' }, [canvas]);
  const gameLayout = el('div', { className: 'hexic-layout' }, [
    boardWrap,
    el('div', { className: 'hexic-side' }, [hud, statusEl, controls]),
  ]);
  root.append(
    gameLayout,
    el('div', { className: 'row' }, [resetBtn, hintBtn]),
    el('div', { className: 'muted hexic-help' },
      'Choose the shared corner of three tiles, then rotate them. Three touching colors clear; six matching tiles around a different center create a silver star. Stars make larger rotations, and six stars create a black pearl.'
    )
  );

  let ctx2d;

  function key(r, c) {
    return r + ':' + c;
  }

  function inBounds(r, c) {
    return r >= 0 && r < ROWS && c >= 0 && c < COLS;
  }

  function cellAt(r, c) {
    return inBounds(r, c) ? grid[r][c] : null;
  }

  // Clockwise around a pointy-top tile: E, SE, SW, W, NW, NE. The column
  // offset for a diagonal neighbor depends on whether this row is staggered.
  function neighborPositions(r, c) {
    const staggered = r % 2 === 1;
    return [
      [r, c + 1],
      [r + 1, c + (staggered ? 1 : 0)],
      [r + 1, c + (staggered ? 0 : -1)],
      [r, c - 1],
      [r - 1, c + (staggered ? 0 : -1)],
      [r - 1, c + (staggered ? 1 : 0)],
    ];
  }

  function neighbors(r, c) {
    return neighborPositions(r, c)
      .filter(([nr, nc]) => inBounds(nr, nc))
      .map(([nr, nc]) => grid[nr][nc]);
  }

  function hexX(r, c) {
    return BORDER + R + STEP_X * c + ROW_OFFSET_X * (r % 2);
  }

  function hexY(r) {
    return BORDER + R + STEP_Y * r;
  }

  function makeTile(color = Math.floor(Math.random() * N_COLORS)) {
    return { type: 'normal', color, bomb: 0 };
  }

  function makeSpecial(type) {
    return { type, color: null, bomb: 0 };
  }

  function initGrid() {
    grid = Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => ({ r, c, tile: EMPTY }))
    );
  }

  function fillFreshBoard() {
    for (const cell of allCells()) cell.tile = EMPTY;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const colors = Array.from({ length: N_COLORS }, (_, color) => color)
          .sort(() => Math.random() - 0.5);
        let placed = false;
        for (const color of colors) {
          grid[r][c].tile = makeTile(color);
          if (!findResolutionEvents().hasEvents) {
            placed = true;
            break;
          }
        }
        if (!placed) {
          grid[r][c].tile = EMPTY;
          return false;
        }
      }
    }
    return true;
  }

  function tileColor(cell) {
    return cell?.tile?.type === 'normal' ? cell.tile.color : null;
  }

  function allCells() {
    const result = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) result.push(grid[r][c]);
    }
    return result;
  }

  // Each unique group is the three hexes around one shared vertex.
  function triangleGroups() {
    const groups = [];
    const seen = new Set();
    for (const center of allCells()) {
      const around = neighborPositions(center.r, center.c);
      for (let i = 0; i < around.length; i++) {
        const [r1, c1] = around[i];
        const [r2, c2] = around[(i + 1) % around.length];
        const cells = [
          center,
          cellAt(r1, c1),
          cellAt(r2, c2),
        ];
        if (cells.some((cell) => !cell)) continue;
        const id = cells.map((cell) => key(cell.r, cell.c)).sort().join('|');
        if (seen.has(id)) continue;
        seen.add(id);
        const point = cells.reduce((sum, cell) => ({
          x: sum.x + hexX(cell.r, cell.c) / 3,
          y: sum.y + hexY(cell.r) / 3,
        }), { x: 0, y: 0 });
        groups.push({ cells, point });
      }
    }
    return groups;
  }

  function cellDistance(px, py, cell) {
    const dx = px - hexX(cell.r, cell.c);
    const dy = py - hexY(cell.r);
    return Math.sqrt(dx * dx + dy * dy);
  }

  function closestCell(px, py) {
    let result = null;
    let distance = Infinity;
    for (const cell of allCells()) {
      const d = cellDistance(px, py, cell);
      if (d < distance) { distance = d; result = cell; }
    }
    // A touch often lands in the narrow seam between two gems. Resolve the
    // nearest gem as long as the pointer is still inside its touch halo.
    return distance <= R * 1.18 ? result : null;
  }

  function closestTriangle(px, py) {
    let result = null;
    let distance = Infinity;
    for (const group of triangleGroups()) {
      const dx = px - group.point.x;
      const dy = py - group.point.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < distance) { distance = d; result = group; }
    }
    // The original game uses a three-piece cursor. On touch screens the
    // cursor needs a forgiving hit area so selecting from a tile center still
    // picks the nearest shared vertex.
    return distance <= R * 1.8 ? result : null;
  }

  function closestTriangleForCell(px, py, cell) {
    let result = null;
    let distance = Infinity;
    for (const group of triangleGroups()) {
      if (!group.cells.includes(cell)) continue;
      const dx = px - group.point.x;
      const dy = py - group.point.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < distance) { distance = d; result = group; }
    }
    return result;
  }

  function selectForCell(cell) {
    if (!cell) return;
    const ring = neighbors(cell.r, cell.c);
    if (cell.tile?.type === 'star' && ring.length === 6) {
      selected = { kind: 'star', center: cell };
    } else if (cell.tile?.type === 'pearl' && ring.length === 6) {
      selected = { kind: 'pearl', center: cell };
      pearlPattern = 0;
    } else {
      const groups = triangleGroups().filter((group) => group.cells.includes(cell));
      selected = groups[0] ? { kind: 'triad', group: groups[0] } : null;
    }
    hint = null;
    updateControls();
    draw();
  }

  function selectAtPoint(px, py) {
    const cell = closestCell(px, py);
    const directGroup = closestTriangle(px, py);
    const cellGroup = cell ? closestTriangleForCell(px, py, cell) : null;
    const group = cell
      ? (directGroup?.cells.includes(cell)
        ? directGroup
        : cellGroup)
      : directGroup;

    if (cell?.tile?.type === 'star' || cell?.tile?.type === 'pearl') {
      selectForCell(cell);
      return;
    }
    if (group) {
      selected = { kind: 'triad', group };
      hint = null;
      updateControls();
      draw();
    }
  }

  function selectedCells() {
    if (!selected) return [];
    if (selected.kind === 'triad') return selected.group.cells;
    if (selected.kind === 'star') return neighbors(selected.center.r, selected.center.c);
    const ring = neighbors(selected.center.r, selected.center.c);
    return ring.filter((_, i) => i % 2 === pearlPattern);
  }

  function rotationPositions(selection = selected) {
    if (!selection) return [];
    if (selection.kind === 'triad') return selection.group.cells;
    if (selection.kind === 'star') return neighbors(selection.center.r, selection.center.c);
    const ring = neighbors(selection.center.r, selection.center.c);
    return ring.filter((_, i) => i % 2 === pearlPattern);
  }

  function applyRotation(cells, direction) {
    const old = cells.map((cell) => cell.tile);
    const n = cells.length;
    const shift = direction > 0 ? 1 : n - 1;
    const movesForAnimation = [];
    for (let i = 0; i < n; i++) {
      const sourceIndex = (i - shift + n) % n;
      cells[i].tile = old[sourceIndex];
      movesForAnimation.push({
        cell: cells[i],
        tile: old[sourceIndex],
        from: { x: hexX(cells[sourceIndex].r, cells[sourceIndex].c), y: hexY(cells[sourceIndex].r) },
        to: { x: hexX(cells[i].r, cells[i].c), y: hexY(cells[i].r) },
      });
    }
    return movesForAnimation;
  }

  function startRotation(cells, direction, done) {
    if (!cells.length) return;
    animation = { moves: applyRotation(cells, direction), cells, t: 0, dur: 190, done };
  }

  function beginTurn(selection, direction) {
    if (over || turnRunning || animation || dropAnimation || !selection) return;
    turnRunning = true;
    selected = null;
    hint = null;
    moves++;
    updateControls();

    const cells = rotationPositions(selection);
    const maxSteps = selection.kind === 'triad' ? 3 : 1;
    let step = 0;

    const spin = () => {
      startRotation(cells, direction, () => {
        step++;
        const hasMatch = findResolutionEvents().hasEvents;
        if (hasMatch || maxSteps === 1 || step >= maxSteps) {
          if (!hasMatch && selection.kind === 'triad') {
            toast('No match — the three tiles return to their starting positions.');
          }
          resolveCascade();
          return;
        }
        spin();
      });
    };
    spin();
  }

  function component(start, predicate, visited) {
    const result = [];
    const queue = [start];
    visited.add(key(start.r, start.c));
    while (queue.length) {
      const cell = queue.shift();
      result.push(cell);
      for (const next of neighbors(cell.r, cell.c)) {
        const id = key(next.r, next.c);
        const nextCell = cellAt(next.r, next.c);
        if (visited.has(id) || !predicate(nextCell)) continue;
        visited.add(id);
        queue.push(nextCell);
      }
    }
    return result;
  }

  function flowerEvents() {
    const flowers = [];
    const pearlFlowers = [];
    for (const center of allCells()) {
      const ring = neighbors(center.r, center.c);
      if (ring.length !== 6) continue;
      const centerTile = center.tile;
      if (centerTile?.type === 'normal') {
        const colors = ring.map((cell) => tileColor(cell));
        if (colors[0] != null && colors.every((color) => color === colors[0]) && colors[0] !== centerTile.color) {
          flowers.push({ center, ring, color: colors[0] });
        }
      }
      if (centerTile?.type === 'normal' && ring.every((cell) => cell.tile?.type === 'star')) {
        pearlFlowers.push({ center, ring });
      }
    }
    return { flowers, pearlFlowers };
  }

  function findResolutionEvents() {
    const { flowers, pearlFlowers } = flowerEvents();
    const clear = new Set();
    const transformed = new Map();
    for (const event of flowers) {
      transformed.set(key(event.center.r, event.center.c), 'star');
      for (const cell of event.ring) clear.add(key(cell.r, cell.c));
    }
    for (const event of pearlFlowers) {
      transformed.set(key(event.center.r, event.center.c), 'pearl');
      for (const cell of event.ring) clear.add(key(cell.r, cell.c));
    }

    const normalClusters = [];
    const visitedColors = new Set();
    for (const cell of allCells()) {
      const id = key(cell.r, cell.c);
      if (visitedColors.has(id) || clear.has(id) || transformed.has(id) || cell.tile?.type !== 'normal') continue;
      const color = cell.tile.color;
      const cluster = component(cell, (next) => {
        const nextId = key(next.r, next.c);
        return !clear.has(nextId) && !transformed.has(nextId) && next.tile?.type === 'normal' && next.tile.color === color;
      }, visitedColors);
      if (cluster.length >= 3) {
        normalClusters.push(cluster);
        for (const match of cluster) clear.add(key(match.r, match.c));
      }
    }

    const starClusters = [];
    const visitedStars = new Set();
    for (const cell of allCells()) {
      const id = key(cell.r, cell.c);
      if (visitedStars.has(id) || clear.has(id) || transformed.has(id) || cell.tile?.type !== 'star') continue;
      const cluster = component(cell, (next) => {
        const nextId = key(next.r, next.c);
        return !clear.has(nextId) && !transformed.has(nextId) && next.tile?.type === 'star';
      }, visitedStars);
      if (cluster.length >= 3) {
        starClusters.push(cluster);
        for (const match of cluster) {
          clear.add(key(match.r, match.c));
          for (const nearby of neighbors(match.r, match.c)) {
            if (nearby.tile) clear.add(key(nearby.r, nearby.c));
          }
        }
      }
    }

    for (const id of transformed.keys()) clear.delete(id);
    return {
      hasEvents: clear.size > 0 || transformed.size > 0,
      clear,
      transformed,
      flowers,
      pearlFlowers,
      normalClusters,
      starClusters,
    };
  }

  function addParticles(cell, tile) {
    if (!cell) return;
    const color = tile?.type === 'normal' ? COLORS[tile.color] : tile?.type === 'star' ? '#e5e7eb' : '#111827';
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: hexX(cell.r, cell.c),
        y: hexY(cell.r),
        vx: (Math.random() - 0.5) * 150,
        vy: (Math.random() - 0.5) * 150 - 35,
        life: 1,
        color,
        size: 3 + Math.random() * 4,
      });
    }
  }

  function applyResolution(events) {
    let gained = 0;
    if (events.normalClusters.length) {
      for (const cluster of events.normalClusters) gained += cluster.length * 10 * Math.max(1, combo);
    }
    if (events.starClusters.length) gained += events.starClusters.reduce((sum, cluster) => sum + cluster.length * 80, 0);
    gained += events.flowers.length * 500;
    gained += events.pearlFlowers.length * 5000;
    combo++;
    score += gained * combo;
    if (score > best) {
      best = score;
      store.set('hexic.best', best);
    }

    for (const id of events.clear) {
      const [r, c] = id.split(':').map(Number);
      const cell = cellAt(r, c);
      if (!cell?.tile) continue;
      addParticles(cell, cell.tile);
      cell.tile = EMPTY;
    }
    for (const [id, type] of events.transformed) {
      const [r, c] = id.split(':').map(Number);
      const cell = cellAt(r, c);
      if (!cell) continue;
      addParticles(cell, cell.tile);
      cell.tile = makeSpecial(type);
    }
    updateHUD();
    collapseAndFill();
  }

  function collapseAndFill() {
    const movesForAnimation = [];
    for (let c = 0; c < COLS; c++) {
      const existing = [];
      for (let r = ROWS - 1; r >= 0; r--) {
        if (grid[r][c].tile) existing.push({ tile: grid[r][c].tile, sourceR: r });
      }
      for (let r = 0; r < ROWS; r++) grid[r][c].tile = EMPTY;

      let index = 0;
      for (let r = ROWS - 1; r >= 0; r--) {
        const entry = existing[index++];
        const tile = entry?.tile || makeTile();
        const sourceR = entry ? entry.sourceR : -1 - (index - existing.length);
        grid[r][c].tile = tile;
        movesForAnimation.push({
          cell: grid[r][c],
          tile,
          from: { x: hexX(r, c), y: hexY(sourceR) },
          to: { x: hexX(r, c), y: hexY(r) },
        });
      }
    }

    maybeSpawnBomb(movesForAnimation);
    dropAnimation = { moves: movesForAnimation, t: 0, dur: 300 };
  }

  function maybeSpawnBomb(dropMoves) {
    if (moves < 5 || allCells().some((cell) => cell.tile?.bomb > 0) || Math.random() > Math.min(0.2, 0.04 + moves * 0.008)) return;
    const candidates = dropMoves.filter(({ tile }) => tile?.type === 'normal' && !tile.bomb);
    if (!candidates.length) return;
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    picked.tile.bomb = 7 + Math.floor(Math.random() * 5);
    toast('A bomb appeared — clear it before its counter reaches zero!', 2600);
  }

  function markBombsBeforeTurn() {
    for (const cell of allCells()) {
      if (cell.tile?.type === 'normal' && cell.tile.bomb > 0) cell.tile._bombActive = true;
    }
  }

  function decrementBombs() {
    for (const cell of allCells()) {
      if (cell.tile?.type === 'normal' && cell.tile.bomb > 0) cell.tile.bomb--;
    }
    return allCells().some((cell) => cell.tile?.type === 'normal' && cell.tile._bombActive && cell.tile.bomb === 0);
  }

  function finishTurn() {
    if (over) return;
    const bombExpired = decrementBombs();
    if (bombExpired) {
      over = true;
      statusEl.textContent = 'A bomb exploded.';
      toast('Bomb exploded — game over.', 2400);
    } else if (!hasValidMoves()) {
      over = true;
      statusEl.textContent = 'No more rotations can make a match.';
    } else {
      statusEl.textContent = 'Select a shared corner between three tiles.';
    }
    combo = 0;
    turnRunning = false;
    updateHUD();
    draw();
  }

  function resolveCascade() {
    if (animation || dropAnimation || over) return;
    const events = findResolutionEvents();
    if (events.hasEvents) {
      applyResolution(events);
      return;
    }
    finishTurn();
  }

  function tryRotation(direction) {
    if (!selected || over || animation || dropAnimation || turnRunning) return;
    markBombsBeforeTurn();
    beginTurn(selected, direction);
  }

  function simulateRotation(cells, direction, steps = 1) {
    const old = cells.map((cell) => cell.tile);
    const n = cells.length;
    const shift = direction > 0 ? 1 : n - 1;
    for (let i = 0; i < n; i++) {
      cells[i].tile = old[(i - shift * steps % n + n) % n];
    }
    const result = findResolutionEvents().hasEvents;
    for (let i = 0; i < n; i++) cells[i].tile = old[i];
    return result;
  }

  function hasValidMoves() {
    for (const group of triangleGroups()) {
      if (
        simulateRotation(group.cells, 1, 1) || simulateRotation(group.cells, 1, 2) ||
        simulateRotation(group.cells, -1, 1) || simulateRotation(group.cells, -1, 2)
      ) return true;
    }
    for (const cell of allCells()) {
      if (cell.tile?.type === 'star') {
        const ring = neighbors(cell.r, cell.c);
        if (ring.length === 6 && (simulateRotation(ring, 1) || simulateRotation(ring, -1))) return true;
      }
      if (cell.tile?.type === 'pearl') {
        const ring = neighbors(cell.r, cell.c);
        for (const pattern of [0, 1]) {
          const group = ring.filter((_, i) => i % 2 === pattern);
          if (simulateRotation(group, 1) || simulateRotation(group, -1)) return true;
        }
      }
    }
    return false;
  }

  function findValidMove() {
    for (const group of triangleGroups()) {
      if (simulateRotation(group.cells, 1, 1) || simulateRotation(group.cells, 1, 2)) {
        return { kind: 'triad', group, direction: 1 };
      }
      if (simulateRotation(group.cells, -1, 1) || simulateRotation(group.cells, -1, 2)) {
        return { kind: 'triad', group, direction: -1 };
      }
    }
    for (const cell of allCells()) {
      if (cell.tile?.type === 'star') {
        const ring = neighbors(cell.r, cell.c);
        if (ring.length === 6 && simulateRotation(ring, 1)) return { kind: 'star', center: cell, direction: 1 };
        if (ring.length === 6 && simulateRotation(ring, -1)) return { kind: 'star', center: cell, direction: -1 };
      }
      if (cell.tile?.type === 'pearl') {
        const ring = neighbors(cell.r, cell.c);
        for (const pattern of [0, 1]) {
          const group = ring.filter((_, i) => i % 2 === pattern);
          if (ring.length === 6 && simulateRotation(group, 1)) return { kind: 'pearl', center: cell, direction: 1, pattern };
          if (ring.length === 6 && simulateRotation(group, -1)) return { kind: 'pearl', center: cell, direction: -1, pattern };
        }
      }
    }
    return null;
  }

  function onPointerDown(event) {
    if (over || turnRunning || animation || dropAnimation) return;
    canvas.setPointerCapture?.(event.pointerId);
    const rect = canvas.getBoundingClientRect();
    // `rect` includes the canvas border. Subtract it before converting CSS
    // pixels to the logical canvas coordinates, otherwise the error grows
    // toward the lower-right corner on a scaled mobile canvas.
    const styles = getComputedStyle(canvas);
    const borderX = (parseFloat(styles.borderLeftWidth) || 0) + (parseFloat(styles.borderRightWidth) || 0);
    const borderY = (parseFloat(styles.borderTopWidth) || 0) + (parseFloat(styles.borderBottomWidth) || 0);
    const contentWidth = Math.max(1, rect.width - borderX);
    const contentHeight = Math.max(1, rect.height - borderY);
    const px = (event.clientX - rect.left - (parseFloat(styles.borderLeftWidth) || 0)) * BW / contentWidth;
    const py = (event.clientY - rect.top - (parseFloat(styles.borderTopWidth) || 0)) * BH / contentHeight;
    focused = closestCell(px, py) || focused;
    selectAtPoint(px, py);
    canvas.focus({ preventScroll: true });
  }

  function onKeyDown(event) {
    if (over) return;
    const movesByKey = {
      ArrowRight: [0, 1], ArrowLeft: [0, -1],
      ArrowDown: [1, 0], ArrowUp: [-1, 0],
    };
    if (movesByKey[event.key]) {
      event.preventDefault();
      const [dr, dc] = movesByKey[event.key];
      focused = {
        r: Math.max(0, Math.min(ROWS - 1, focused.r + dr)),
        c: Math.max(0, Math.min(COLS - 1, focused.c + dc)),
      };
      draw();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectForCell(grid[focused.r][focused.c]);
      return;
    }
    if (event.key.toLowerCase() === 'q') {
      event.preventDefault();
      tryRotation(-1);
    } else if (event.key.toLowerCase() === 'e') {
      event.preventDefault();
      tryRotation(1);
    }
  }

  function updateControls() {
    const enabled = Boolean(selected) && !over && !animation && !dropAnimation && !turnRunning;
    rotateCcwBtn.disabled = !enabled;
    rotateCwBtn.disabled = !enabled;
    const isPearl = selected?.kind === 'pearl';
    pearlBtn.hidden = !isPearl;
    pearlBtn.disabled = !enabled;
    pearlBtn.textContent = pearlPattern === 0 ? 'Y pattern' : 'Inverted Y';
    if (!selected) {
      statusEl.textContent = over ? statusEl.textContent : 'Select a shared corner between three tiles.';
    } else if (selected.kind === 'triad') {
      statusEl.textContent = 'Three tiles selected — choose a rotation direction.';
    } else if (selected.kind === 'star') {
      statusEl.textContent = 'Silver star selected — rotate all six surrounding tiles.';
    } else {
      statusEl.textContent = pearlPattern === 0
        ? 'Black pearl selected — move the Y of three surrounding tiles.'
        : 'Black pearl selected — move the inverted Y of three surrounding tiles.';
    }
  }

  function updateHUD() {
    scoreEl.textContent = String(score);
    bestEl.textContent = 'Best: ' + best;
    movesEl.textContent = 'Moves: ' + moves + (combo > 1 ? ' · Combo x' + combo : '');
    const bombs = allCells().filter((cell) => cell.tile?.type === 'normal' && cell.tile.bomb > 0);
    bombEl.textContent = bombs.length
      ? 'Bombs: ' + bombs.map((cell) => cell.tile.bomb).join(', ')
      : 'Bombs: none';
  }

  function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const available = canvas.parentElement?.clientWidth || BW;
    const scale = Math.min(Math.max((available - 8) / BW, 0.44), 1);
    // The CSS size already applies the responsive scale. Match the backing
    // bitmap to that size so the browser does not scale the drawing a second
    // time after the context transform below.
    canvas.width = Math.round(BW * dpr * scale);
    canvas.height = Math.round(BH * dpr * scale);
    canvas.style.width = Math.round(BW * scale) + 'px';
    canvas.style.height = Math.round(BH * scale) + 'px';
    ctx2d = canvas.getContext('2d');
    ctx2d.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    draw();
  }

  function drawHex(cx, cy, r, fill, stroke, lineWidth = 1) {
    ctx2d.beginPath();
    for (let i = 0; i < 6; i++) {
      const [x, y] = hexCorner(cx, cy, r, i);
      i === 0 ? ctx2d.moveTo(x, y) : ctx2d.lineTo(x, y);
    }
    ctx2d.closePath();
    if (fill) { ctx2d.fillStyle = fill; ctx2d.fill(); }
    if (stroke) { ctx2d.strokeStyle = stroke; ctx2d.lineWidth = lineWidth; ctx2d.stroke(); }
  }

  function drawStar(cx, cy, outer, inner) {
    ctx2d.beginPath();
    for (let i = 0; i < 12; i++) {
      const radius = i % 2 ? inner : outer;
      const angle = -Math.PI / 2 + i * Math.PI / 6;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      i ? ctx2d.lineTo(x, y) : ctx2d.moveTo(x, y);
    }
    ctx2d.closePath();
    ctx2d.fillStyle = '#f8fafc';
    ctx2d.fill();
    ctx2d.strokeStyle = 'rgba(30,41,59,0.75)';
    ctx2d.lineWidth = 1;
    ctx2d.stroke();
  }

  function drawTile(tile, x, y, alpha = 1) {
    if (!tile) return;
    ctx2d.save();
    ctx2d.globalAlpha = alpha;
    ctx2d.shadowBlur = 8;
    ctx2d.shadowColor = tile.type === 'normal' ? COLORS[tile.color] : tile.type === 'star' ? '#cbd5e1' : '#020617';

    if (tile.type === 'normal') {
      drawHex(x, y, R - 2, COLORS[tile.color], 'rgba(255,255,255,0.24)');
      drawHex(x, y, R - 7, null, 'rgba(15,23,42,0.22)');
      ctx2d.beginPath();
      ctx2d.arc(x - R * 0.27, y - R * 0.26, R * 0.2, 0, Math.PI * 2);
      ctx2d.fillStyle = 'rgba(255,255,255,0.24)';
      ctx2d.fill();
      if (tile.bomb > 0) {
        ctx2d.shadowBlur = 0;
        ctx2d.beginPath();
        ctx2d.arc(x, y, R * 0.58, 0, Math.PI * 2);
        ctx2d.fillStyle = 'rgba(15,23,42,0.65)';
        ctx2d.fill();
        ctx2d.fillStyle = '#f8fafc';
        ctx2d.font = '800 15px ui-sans-serif, system-ui, sans-serif';
        ctx2d.textAlign = 'center';
        ctx2d.textBaseline = 'middle';
        ctx2d.fillText(String(tile.bomb), x, y + 1);
        ctx2d.strokeStyle = '#fbbf24';
        ctx2d.lineWidth = 2;
        ctx2d.beginPath();
        ctx2d.arc(x, y, R * 0.7, 0, Math.PI * 2);
        ctx2d.stroke();
      }
    } else if (tile.type === 'star') {
      const gradient = ctx2d.createRadialGradient(x - 7, y - 8, 2, x, y, R);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.35, '#dbeafe');
      gradient.addColorStop(1, '#64748b');
      drawHex(x, y, R - 2, gradient, '#f8fafc');
      drawStar(x, y, R * 0.58, R * 0.25);
    } else {
      const gradient = ctx2d.createRadialGradient(x - 7, y - 8, 1, x, y, R);
      gradient.addColorStop(0, '#64748b');
      gradient.addColorStop(0.3, '#111827');
      gradient.addColorStop(1, '#020617');
      drawHex(x, y, R - 2, gradient, '#94a3b8', 1.5);
      ctx2d.shadowBlur = 0;
      ctx2d.beginPath();
      ctx2d.arc(x - R * 0.22, y - R * 0.25, R * 0.14, 0, Math.PI * 2);
      ctx2d.fillStyle = 'rgba(255,255,255,0.55)';
      ctx2d.fill();
    }
    ctx2d.restore();
  }

  function selectedCellsForHint(move) {
    if (move.kind === 'star') return neighbors(move.center.r, move.center.c);
    if (move.kind === 'pearl') {
      const ring = neighbors(move.center.r, move.center.c);
      return ring.filter((_, i) => i % 2 === (move.pattern || 0));
    }
    return [];
  }

  function drawSelection() {
    if (hint) {
      ctx2d.setLineDash([5, 4]);
      for (const cell of hint.kind === 'triad' ? hint.group.cells : selectedCellsForHint(hint)) {
        drawHex(hexX(cell.r, cell.c), hexY(cell.r), R + 4, null, '#fbbf24', 2);
      }
      ctx2d.setLineDash([]);
    }
    if (selected) {
      for (const cell of selectedCells()) {
        drawHex(hexX(cell.r, cell.c), hexY(cell.r), R + 4, null, '#22d3ee', 2.5);
      }
      if (selected.kind === 'triad') {
        ctx2d.beginPath();
        ctx2d.arc(selected.group.point.x, selected.group.point.y, 5, 0, Math.PI * 2);
        ctx2d.fillStyle = '#22d3ee';
        ctx2d.fill();
      }
    }
    if (document.activeElement === canvas) {
      const cell = grid[focused.r][focused.c];
      drawHex(hexX(cell.r, cell.c), hexY(cell.r), R + 6, null, '#94a3b8', 1.5);
    }
  }

  function draw() {
    if (!ctx2d) return;
    ctx2d.clearRect(0, 0, BW, BH);
    ctx2d.fillStyle = 'rgba(2,6,23,0.35)';
    ctx2d.fillRect(0, 0, BW, BH);

    for (const cell of allCells()) {
      drawHex(hexX(cell.r, cell.c), hexY(cell.r), R, 'rgba(255,255,255,0.035)', 'rgba(255,255,255,0.1)');
    }

    const animatedCells = new Set();
    if (dropAnimation) {
      for (const move of dropAnimation.moves) animatedCells.add(key(move.cell.r, move.cell.c));
    } else if (animation) {
      for (const move of animation.moves) animatedCells.add(key(move.cell.r, move.cell.c));
    }

    if (!dropAnimation) {
      for (const cell of allCells()) {
        if (!animatedCells.has(key(cell.r, cell.c))) drawTile(cell.tile, hexX(cell.r, cell.c), hexY(cell.r));
      }
    }

    if (dropAnimation) {
      const p = Math.min(dropAnimation.t / dropAnimation.dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      for (const move of dropAnimation.moves) {
        drawTile(move.tile,
          move.from.x + (move.to.x - move.from.x) * eased,
          move.from.y + (move.to.y - move.from.y) * eased,
          Math.min(1, 0.35 + p * 0.8));
      }
    } else if (animation) {
      const p = Math.min(animation.t / animation.dur, 1);
      const eased = p * (2 - p);
      for (const move of animation.moves) {
        drawTile(move.tile,
          move.from.x + (move.to.x - move.from.x) * eased,
          move.from.y + (move.to.y - move.from.y) * eased);
      }
    }

    drawSelection();

    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      ctx2d.globalAlpha = particle.life * 0.8;
      ctx2d.beginPath();
      ctx2d.arc(particle.x, particle.y, particle.size * particle.life, 0, Math.PI * 2);
      ctx2d.fillStyle = particle.color;
      ctx2d.fill();
    }
    ctx2d.globalAlpha = 1;

    if (over) {
      ctx2d.fillStyle = 'rgba(11,13,18,0.82)';
      ctx2d.fillRect(0, 0, BW, BH);
      ctx2d.fillStyle = '#e7ecf3';
      ctx2d.font = '700 30px ui-sans-serif, system-ui, sans-serif';
      ctx2d.textAlign = 'center';
      ctx2d.fillText('Game Over', BW / 2, BH / 2 - 14);
      ctx2d.font = '500 16px ui-sans-serif, system-ui, sans-serif';
      ctx2d.fillStyle = '#9aa3b2';
      ctx2d.fillText('Score: ' + score, BW / 2, BH / 2 + 14);
    }
  }

  function tick(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    if (animation) {
      animation.t += dt * 1000;
      if (animation.t >= animation.dur) {
        const done = animation.done;
        animation = null;
        done?.();
      }
    } else if (dropAnimation) {
      dropAnimation.t += dt * 1000;
      if (dropAnimation.t >= dropAnimation.dur) {
        dropAnimation = null;
        resolveCascade();
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt * 2.8;
      if (particle.life <= 0) particles.splice(i, 1);
    }
    updateHUD();
    draw();
    rafId = requestAnimationFrame(tick);
  }

  function startGame() {
    initGrid();
    let attempts = 0;
    let filled = false;
    do {
      filled = fillFreshBoard();
      attempts++;
    } while ((!filled || findResolutionEvents().hasEvents || !hasValidMoves()) && attempts < 200);
    score = 0;
    moves = 0;
    combo = 0;
    over = false;
    selected = null;
    hint = null;
    animation = null;
    dropAnimation = null;
    turnRunning = false;
    particles = [];
    focused = { r: 0, c: 0 };
    updateControls();
    updateHUD();
    sizeCanvas();
  }

  function onNewGame() {
    startGame();
    resetBtn.blur();
  }

  function onHint() {
    if (over || animation || dropAnimation || turnRunning) return;
    const move = findValidMove();
    hint = move;
    if (move) {
      if (move.kind === 'triad') selected = { kind: 'triad', group: move.group };
      else if (move.kind === 'star') selected = { kind: 'star', center: move.center };
      else {
        selected = { kind: 'pearl', center: move.center };
        pearlPattern = move.pattern || 0;
      }
      updateControls();
      statusEl.textContent = 'Hint: try the highlighted rotation.';
    }
    hintBtn.blur();
    draw();
  }

  rotateCcwBtn.addEventListener('click', () => { tryRotation(-1); rotateCcwBtn.blur(); });
  rotateCwBtn.addEventListener('click', () => { tryRotation(1); rotateCwBtn.blur(); });
  pearlBtn.addEventListener('click', () => {
    if (selected?.kind !== 'pearl' || turnRunning || animation || dropAnimation) return;
    pearlPattern = pearlPattern ? 0 : 1;
    updateControls();
    draw();
  });
  resetBtn.addEventListener('click', onNewGame);
  hintBtn.addEventListener('click', onHint);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', sizeCanvas);
  const boardResizeObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => sizeCanvas())
    : null;
  boardResizeObserver?.observe(boardWrap);

  startGame();
  // The grid can settle after the first render (especially when switching
  // between the desktop side panel and the mobile stacked layout).
  requestAnimationFrame(sizeCanvas);
  lastTime = performance.now();
  rafId = requestAnimationFrame(tick);

  onCleanup(() => {
    cancelAnimationFrame(rafId);
    resetBtn.removeEventListener('click', onNewGame);
    hintBtn.removeEventListener('click', onHint);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('resize', sizeCanvas);
    boardResizeObserver?.disconnect();
  });
}

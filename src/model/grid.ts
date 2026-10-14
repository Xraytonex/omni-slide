import type { CellKey, Deck, Dir, Pos, Slide, SlideId } from './types';

export const DELTA: Record<Dir, Pos> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const DIRS: Dir[] = ['up', 'down', 'left', 'right'];

export function key(p: Pos): CellKey {
  return `${p.x},${p.y}`;
}

export function parseKey(k: string): Pos {
  const [x, y] = k.split(',').map(Number);
  return { x, y };
}

export function samePos(a: Pos, b: Pos): boolean {
  return a.x === b.x && a.y === b.y;
}

export function slideAt(deck: Deck, p: Pos): Slide | undefined {
  const id = deck.cells[key(p)];
  return id ? deck.slides[id] : undefined;
}

export function step(p: Pos, dir: Dir): Pos {
  return { x: p.x + DELTA[dir].x, y: p.y + DELTA[dir].y };
}

/** The cell reached by pressing `dir` from `p`, or null if there is no slide there. */
export function neighbor(deck: Deck, p: Pos, dir: Dir): Pos | null {
  const n = step(p, dir);
  return deck.cells[key(n)] ? n : null;
}

export function occupied(deck: Deck): Pos[] {
  return Object.keys(deck.cells).map(parseKey);
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Bounding box of occupied cells, or null for an empty deck. */
export function bounds(deck: Deck): Bounds | null {
  const ps = occupied(deck);
  if (ps.length === 0) return null;
  return {
    minX: Math.min(...ps.map((p) => p.x)),
    minY: Math.min(...ps.map((p) => p.y)),
    maxX: Math.max(...ps.map((p) => p.x)),
    maxY: Math.max(...ps.map((p) => p.y)),
  };
}

/** Shift everything so the top-left occupied cell is (0,0) and make sure `start` points at a slide. */
export function normalize(deck: Deck): Deck {
  const b = bounds(deck);
  if (!b) return { ...deck, cells: {}, start: { x: 0, y: 0 } };
  const cells: Record<CellKey, SlideId> = {};
  for (const [k, id] of Object.entries(deck.cells)) {
    const p = parseKey(k);
    cells[key({ x: p.x - b.minX, y: p.y - b.minY })] = id;
  }
  let start = { x: deck.start.x - b.minX, y: deck.start.y - b.minY };
  if (!cells[key(start)]) start = firstCell(cells);
  return { ...deck, cells, start };
}

/** Top-most, then left-most occupied cell. */
function firstCell(cells: Record<CellKey, SlideId>): Pos {
  const ps = Object.keys(cells).map(parseKey);
  ps.sort((a, b) => a.y - b.y || a.x - b.x);
  return ps[0] ?? { x: 0, y: 0 };
}

/** Move the slide at `from` to `to`; if `to` is occupied the two slides swap. */
export function moveSlide(deck: Deck, from: Pos, to: Pos): Deck {
  const id = deck.cells[key(from)];
  if (!id || samePos(from, to)) return deck;
  const cells = { ...deck.cells };
  const other = cells[key(to)];
  delete cells[key(from)];
  if (other) cells[key(from)] = other;
  cells[key(to)] = id;
  // The start marker follows the slide it was on.
  let start = deck.start;
  if (samePos(start, from)) start = to;
  else if (other && samePos(start, to)) start = from;
  return normalize({ ...deck, cells, start });
}

function shiftCells(
  deck: Deck,
  f: (p: Pos) => Pos,
): { cells: Record<CellKey, SlideId>; start: Pos } {
  const cells: Record<CellKey, SlideId> = {};
  for (const [k, id] of Object.entries(deck.cells)) cells[key(f(parseKey(k)))] = id;
  return { cells, start: f(deck.start) };
}

/** Insert an empty row before row `y` (everything at or below `y` moves down). */
export function insertRow(deck: Deck, y: number): Deck {
  const { cells, start } = shiftCells(deck, (p) => (p.y >= y ? { x: p.x, y: p.y + 1 } : p));
  return normalize({ ...deck, cells, start });
}

/** Insert an empty column before column `x` (everything at or right of `x` moves right). */
export function insertColumn(deck: Deck, x: number): Deck {
  const { cells, start } = shiftCells(deck, (p) => (p.x >= x ? { x: p.x + 1, y: p.y } : p));
  return normalize({ ...deck, cells, start });
}

/** Remove the slide at `p` (the cell becomes empty; nothing else moves). */
export function removeSlide(deck: Deck, p: Pos): Deck {
  const id = deck.cells[key(p)];
  if (!id) return deck;
  const cells = { ...deck.cells };
  delete cells[key(p)];
  const slides = { ...deck.slides };
  delete slides[id];
  return normalize({ ...deck, cells, slides });
}

/** Add slides as a new row below everything else, left to right. */
export function appendRow(deck: Deck, newSlides: Slide[]): Deck {
  if (newSlides.length === 0) return deck;
  const b = bounds(deck);
  const y = b ? b.maxY + 1 : 0;
  const x0 = b ? b.minX : 0;
  const cells = { ...deck.cells };
  const slides = { ...deck.slides };
  newSlides.forEach((s, i) => {
    slides[s.id] = s;
    cells[key({ x: x0 + i, y })] = s.id;
  });
  return normalize({ ...deck, cells, slides, start: b ? deck.start : { x: x0, y } });
}

export function setStart(deck: Deck, p: Pos): Deck {
  return deck.cells[key(p)] ? { ...deck, start: p } : deck;
}

export function posOf(deck: Deck, id: SlideId): Pos | null {
  for (const [k, v] of Object.entries(deck.cells)) if (v === id) return parseKey(k);
  return null;
}

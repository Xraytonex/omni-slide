import { describe, expect, it } from 'vitest';
import {
  appendRow,
  bounds,
  insertColumn,
  insertRow,
  moveSlide,
  neighbor,
  normalize,
  removeSlide,
  setStart,
} from './grid';
import type { Deck, Slide } from './types';

const slide = (id: string): Slide => ({ id, kind: 'image', assetId: id, width: 16, height: 9 });

function deck(cells: Record<string, string>, start = { x: 0, y: 0 }): Deck {
  const slides: Record<string, Slide> = {};
  for (const id of Object.values(cells)) slides[id] = slide(id);
  return {
    id: 'd',
    name: 'd',
    createdAt: 0,
    updatedAt: 0,
    slides,
    cells: cells as Deck['cells'],
    start,
  };
}

describe('neighbor', () => {
  const d = deck({ '0,0': 'a', '1,0': 'b', '0,1': 'c' });
  it('finds occupied neighbors', () => {
    expect(neighbor(d, { x: 0, y: 0 }, 'right')).toEqual({ x: 1, y: 0 });
    expect(neighbor(d, { x: 0, y: 0 }, 'down')).toEqual({ x: 0, y: 1 });
    expect(neighbor(d, { x: 0, y: 1 }, 'up')).toEqual({ x: 0, y: 0 });
  });
  it('returns null for empty cells', () => {
    expect(neighbor(d, { x: 0, y: 0 }, 'left')).toBeNull();
    expect(neighbor(d, { x: 0, y: 0 }, 'up')).toBeNull();
    expect(neighbor(d, { x: 1, y: 0 }, 'down')).toBeNull();
  });
});

describe('moveSlide', () => {
  it('moves into an empty cell', () => {
    const d = moveSlide(deck({ '0,0': 'a', '1,0': 'b' }), { x: 1, y: 0 }, { x: 0, y: 1 });
    expect(d.cells).toEqual({ '0,0': 'a', '0,1': 'b' });
  });
  it('swaps with an occupied cell and the start follows its slide', () => {
    const d = moveSlide(deck({ '0,0': 'a', '1,0': 'b' }), { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(d.cells).toEqual({ '0,0': 'b', '1,0': 'a' });
    expect(d.start).toEqual({ x: 1, y: 0 });
  });
  it('normalizes when moving to negative coordinates', () => {
    const d = moveSlide(deck({ '0,0': 'a', '1,0': 'b' }), { x: 1, y: 0 }, { x: -1, y: -1 });
    expect(d.cells).toEqual({ '1,1': 'a', '0,0': 'b' });
    expect(d.start).toEqual({ x: 1, y: 1 });
  });
  it('is a no-op from an empty cell', () => {
    const d0 = deck({ '0,0': 'a' });
    expect(moveSlide(d0, { x: 3, y: 3 }, { x: 0, y: 0 })).toBe(d0);
  });
});

describe('normalize', () => {
  it('shifts to origin and repairs start', () => {
    const d = normalize(deck({ '2,3': 'a', '3,3': 'b' }, { x: 9, y: 9 }));
    expect(d.cells).toEqual({ '0,0': 'a', '1,0': 'b' });
    expect(d.start).toEqual({ x: 0, y: 0 });
  });
  it('handles an empty deck', () => {
    expect(bounds(normalize(deck({})))).toBeNull();
  });
});

describe('appendRow', () => {
  it('starts at the origin on an empty deck', () => {
    const d = appendRow(deck({}), [slide('a'), slide('b')]);
    expect(d.cells).toEqual({ '0,0': 'a', '1,0': 'b' });
    expect(Object.keys(d.slides)).toEqual(['a', 'b']);
  });
  it('adds a row below existing content', () => {
    const d = appendRow(deck({ '0,0': 'a', '0,1': 'b' }), [slide('c'), slide('d')]);
    expect(d.cells['0,2']).toBe('c');
    expect(d.cells['1,2']).toBe('d');
    expect(d.start).toEqual({ x: 0, y: 0 });
  });
});

describe('insert / remove', () => {
  it('inserts a row', () => {
    const d = insertRow(deck({ '0,0': 'a', '0,1': 'b' }, { x: 0, y: 1 }), 1);
    expect(d.cells).toEqual({ '0,0': 'a', '0,2': 'b' });
    expect(d.start).toEqual({ x: 0, y: 2 });
  });
  it('inserts a column', () => {
    const d = insertColumn(deck({ '0,0': 'a', '1,0': 'b' }), 1);
    expect(d.cells).toEqual({ '0,0': 'a', '2,0': 'b' });
  });
  it('removes a slide and its data', () => {
    const d = removeSlide(deck({ '0,0': 'a', '1,0': 'b' }), { x: 0, y: 0 });
    expect(d.cells).toEqual({ '0,0': 'b' });
    expect(d.slides).toEqual({ b: slide('b') });
    expect(d.start).toEqual({ x: 0, y: 0 });
  });
  it('setStart ignores empty cells', () => {
    const d0 = deck({ '0,0': 'a', '1,0': 'b' });
    expect(setStart(d0, { x: 1, y: 0 }).start).toEqual({ x: 1, y: 0 });
    expect(setStart(d0, { x: 5, y: 0 }).start).toEqual({ x: 0, y: 0 });
  });
});

import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, createHistory, record, redo, seal, snapshots, undo } from './history';

describe('history', () => {
  it('undoes and redoes in order', () => {
    let h = createHistory('a');
    h = record(h, 'b');
    h = record(h, 'c');
    expect(h.present).toBe('c');
    h = undo(h);
    expect(h.present).toBe('b');
    h = undo(h);
    expect(h.present).toBe('a');
    expect(canUndo(h)).toBe(false);
    h = redo(h);
    expect(h.present).toBe('b');
    h = redo(h);
    expect(h.present).toBe('c');
    expect(canRedo(h)).toBe(false);
  });

  it('is a no-op at either end', () => {
    const h = createHistory('a');
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it('ignores recording the same snapshot', () => {
    const h = createHistory({ v: 1 });
    expect(record(h, h.present)).toBe(h);
  });

  it('clears the redo stack on a new change', () => {
    let h = record(record(createHistory('a'), 'b'), 'c');
    h = undo(h);
    expect(canRedo(h)).toBe(true);
    h = record(h, 'd');
    expect(canRedo(h)).toBe(false);
    expect(snapshots(h)).toEqual(['a', 'b', 'd']);
  });

  it('merges consecutive changes with the same tag', () => {
    let h = createHistory('');
    h = record(h, 'H', 'name');
    h = record(h, 'Hi', 'name');
    h = record(h, 'Hi!', 'name');
    expect(h.past).toEqual(['']);
    expect(undo(h).present).toBe('');
  });

  it('starts a new step when the tag changes, is null, or after seal/undo', () => {
    let h = record(createHistory('a'), 'b', 'x');
    h = record(h, 'c', 'y');
    expect(h.past).toEqual(['a', 'b']);
    h = record(h, 'd');
    h = record(h, 'e');
    expect(h.past).toEqual(['a', 'b', 'c', 'd']);
    h = record(seal(record(h, 'f', 'x')), 'g', 'x');
    expect(h.past).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    h = record(redo(undo(h)), 'h', 'x');
    expect(h.past).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });

  it('drops the oldest steps past the limit', () => {
    let h = createHistory(0);
    for (let i = 1; i <= 5; i++) h = record(h, i, null, 3);
    expect(h.past).toEqual([2, 3, 4]);
    expect(h.present).toBe(5);
  });
});

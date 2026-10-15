/** Undo/redo stack of immutable snapshots. Pure; every function returns a new History. */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /**
   * Tag of the last recorded change. Consecutive changes recorded with the same non-null tag
   * merge into one undo step (e.g. typing a deck name one character at a time).
   */
  tag: string | null;
}

export const HISTORY_LIMIT = 100;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], tag: null };
}

/** Record `next` as the new present. Clears the redo stack; keeps at most `limit` undo steps. */
export function record<T>(
  h: History<T>,
  next: T,
  tag: string | null = null,
  limit = HISTORY_LIMIT,
): History<T> {
  if (next === h.present) return h;
  if (tag !== null && tag === h.tag) return { ...h, present: next, future: [] };
  const past = [...h.past, h.present];
  if (past.length > limit) past.splice(0, past.length - limit);
  return { past, present: next, future: [], tag };
}

/** End the current merge group so the next tagged change starts a new undo step. */
export function seal<T>(h: History<T>): History<T> {
  return h.tag === null ? h : { ...h, tag: null };
}

export function canUndo<T>(h: History<T>): boolean {
  return h.past.length > 0;
}

export function canRedo<T>(h: History<T>): boolean {
  return h.future.length > 0;
}

export function undo<T>(h: History<T>): History<T> {
  if (!canUndo(h)) return h;
  return {
    past: h.past.slice(0, -1),
    present: h.past[h.past.length - 1],
    future: [h.present, ...h.future],
    tag: null,
  };
}

export function redo<T>(h: History<T>): History<T> {
  if (!canRedo(h)) return h;
  return {
    past: [...h.past, h.present],
    present: h.future[0],
    future: h.future.slice(1),
    tag: null,
  };
}

/** Every snapshot still reachable through undo/redo, including the present. */
export function snapshots<T>(h: History<T>): T[] {
  return [...h.past, h.present, ...h.future];
}

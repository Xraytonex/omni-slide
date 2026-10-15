import type { Deck } from '../model/types';
import { forgetAsset } from './assetUrl';
import { deleteAsset, getAsset, putAsset } from './db';

// Removing a slide deletes its image from IndexedDB right away, so closing the tab never leaves
// orphaned blobs behind. Undo needs those bytes back, so they're kept here, in memory, until the
// editor says no undo/redo step can reach them any more. The cached object URL is kept alive too,
// which makes a restored slide show up instantly.
const trash = new Map<string, Blob>();

// Stash/restore must run in order: undoing a delete can happen before the delete finished.
let queue: Promise<void> = Promise.resolve();

function enqueue(job: () => Promise<void>): Promise<void> {
  const run = queue.then(job);
  queue = run.catch((e) => console.error('asset sync failed', e));
  return run;
}

function assetIds(deck: Deck): Set<string> {
  return new Set(Object.values(deck.slides).map((s) => s.assetId));
}

/**
 * Bring the asset store in line with a deck change. Assets of slides that disappeared move to the
 * trash; assets of slides that came back (undo/redo) are restored from it.
 */
export function syncAssets(prev: Deck, next: Deck): Promise<void> {
  const before = assetIds(prev);
  const after = assetIds(next);
  const removed = [...before].filter((id) => !after.has(id));
  const added = [...after].filter((id) => !before.has(id));
  if (removed.length === 0 && added.length === 0) return queue;
  return enqueue(async () => {
    for (const id of removed) {
      const blob = await getAsset(id);
      if (blob) trash.set(id, blob);
      await deleteAsset(id);
    }
    for (const id of added) {
      const blob = trash.get(id);
      // Not in the trash means a freshly imported slide, whose asset is already stored.
      if (!blob) continue;
      await putAsset(id, blob);
      trash.delete(id);
    }
  });
}

/** Permanently drop trashed assets that none of `keep` (e.g. the undo history) refers to. */
export function emptyTrash(keep: Deck[] = []): Promise<void> {
  return enqueue(async () => {
    const live = new Set(keep.flatMap((d) => [...assetIds(d)]));
    for (const id of [...trash.keys()]) {
      if (live.has(id)) continue;
      trash.delete(id);
      forgetAsset(id);
    }
  });
}

/** For tests. */
export function trashedAssets(): string[] {
  return [...trash.keys()];
}

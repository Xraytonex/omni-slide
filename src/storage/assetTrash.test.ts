import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Deck, ImageSlide } from '../model/types';

const store = new Map<string, Blob>();
vi.mock('./db', () => ({
  getAsset: async (id: string) => store.get(id),
  putAsset: async (id: string, b: Blob) => void store.set(id, b),
  deleteAsset: async (id: string) => void store.delete(id),
}));
const forgotten: string[] = [];
vi.mock('./assetUrl', () => ({ forgetAsset: (id: string) => forgotten.push(id) }));

const { emptyTrash, syncAssets, trashedAssets } = await import('./assetTrash');

function deck(...ids: string[]): Deck {
  const slides: Record<string, ImageSlide> = {};
  ids.forEach(
    (id) => (slides[id] = { id, kind: 'image', assetId: `a-${id}`, width: 1, height: 1 }),
  );
  return {
    id: 'd',
    name: 'd',
    createdAt: 0,
    updatedAt: 0,
    slides,
    cells: {},
    start: { x: 0, y: 0 },
  };
}

describe('assetTrash', () => {
  beforeEach(async () => {
    await emptyTrash();
    store.clear();
    forgotten.length = 0;
    for (const id of ['a-1', 'a-2']) store.set(id, new Blob([id]));
  });

  it('moves removed assets to the trash and restores them', async () => {
    const both = deck('1', '2');
    const one = deck('1');
    await syncAssets(both, one);
    expect(store.has('a-2')).toBe(false);
    expect(trashedAssets()).toEqual(['a-2']);

    await syncAssets(one, both);
    expect(await store.get('a-2')?.text()).toBe('a-2');
    expect(trashedAssets()).toEqual([]);
  });

  it('handles an undo issued before the delete finished', async () => {
    const both = deck('1', '2');
    const one = deck('1');
    syncAssets(both, one);
    await syncAssets(one, both);
    expect(store.has('a-2')).toBe(true);
  });

  it('leaves newly imported assets alone', async () => {
    store.set('a-3', new Blob(['a-3']));
    await syncAssets(deck('1'), deck('1', '3'));
    expect(store.has('a-3')).toBe(true);
  });

  it('only empties assets no kept deck refers to', async () => {
    await syncAssets(deck('1', '2'), deck());
    await emptyTrash([deck('2')]);
    expect(trashedAssets()).toEqual(['a-2']);
    expect(forgotten).toEqual(['a-1']);
    await emptyTrash();
    expect(trashedAssets()).toEqual([]);
  });
});

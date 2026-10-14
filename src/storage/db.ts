import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Deck } from '../model/types';

interface OmniDB extends DBSchema {
  decks: { key: string; value: Deck };
  assets: { key: string; value: Blob };
}

let dbPromise: Promise<IDBPDatabase<OmniDB>> | null = null;

function db() {
  dbPromise ??= openDB<OmniDB>('omni-slide', 1, {
    upgrade(d) {
      d.createObjectStore('decks', { keyPath: 'id' });
      d.createObjectStore('assets');
    },
  });
  return dbPromise;
}

export function newId(): string {
  return crypto.randomUUID();
}

export async function listDecks(): Promise<Deck[]> {
  const decks = await (await db()).getAll('decks');
  return decks.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getDeck(id: string): Promise<Deck | undefined> {
  return (await db()).get('decks', id);
}

export async function saveDeck(deck: Deck): Promise<Deck> {
  const d = { ...deck, updatedAt: Date.now() };
  await (await db()).put('decks', d);
  return d;
}

export async function createDeck(name: string): Promise<Deck> {
  const now = Date.now();
  const deck: Deck = {
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
    slides: {},
    cells: {},
    start: { x: 0, y: 0 },
  };
  await (await db()).put('decks', deck);
  return deck;
}

export async function deleteDeck(deck: Deck): Promise<void> {
  const tx = (await db()).transaction(['decks', 'assets'], 'readwrite');
  await Promise.all([
    tx.objectStore('decks').delete(deck.id),
    ...Object.values(deck.slides).map((s) => tx.objectStore('assets').delete(s.assetId)),
    tx.done,
  ]);
}

export async function putAsset(id: string, blob: Blob): Promise<void> {
  await (await db()).put('assets', blob, id);
}

export async function getAsset(id: string): Promise<Blob | undefined> {
  return (await db()).get('assets', id);
}

export async function deleteAsset(id: string): Promise<void> {
  await (await db()).delete('assets', id);
}

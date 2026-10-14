import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { normalize } from '../model/grid';
import type { Deck, Slide } from '../model/types';
import { getAsset, newId, putAsset, saveDeck } from './db';

const FORMAT = 'omni-slide';
const VERSION = 1;

/** Bundle a deck and its images into a `.omni` zip. */
export async function exportDeck(deck: Deck): Promise<Blob> {
  const files: Zippable = {
    'deck.json': strToU8(JSON.stringify({ format: FORMAT, version: VERSION, deck }, null, 2)),
  };
  for (const s of Object.values(deck.slides)) {
    const blob = await getAsset(s.assetId);
    if (blob) files[`assets/${s.assetId}`] = new Uint8Array(await blob.arrayBuffer());
  }
  return new Blob([zipSync(files, { level: 0 }) as Uint8Array<ArrayBuffer>], {
    type: 'application/zip',
  });
}

/** Import a `.omni` file as a new deck (fresh ids so it never clobbers an existing one). */
export async function importDeckFile(file: Blob): Promise<Deck> {
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const manifest = files['deck.json'];
  if (!manifest) throw new Error('Not an Omni Slide file (missing deck.json)');
  const parsed = JSON.parse(strFromU8(manifest));
  if (parsed.format !== FORMAT) throw new Error('Not an Omni Slide file');
  if (parsed.version > VERSION) throw new Error('File was made by a newer version of Omni Slide');
  const src: Deck = parsed.deck;

  const slides: Record<string, Slide> = {};
  for (const s of Object.values(src.slides)) {
    const data = files[`assets/${s.assetId}`];
    if (!data) continue;
    const assetId = newId();
    await putAsset(assetId, new Blob([data as Uint8Array<ArrayBuffer>], { type: sniffType(data) }));
    slides[s.id] = { ...s, assetId };
  }
  const cells = Object.fromEntries(
    Object.entries(src.cells).filter(([, id]) => slides[id]),
  ) as Deck['cells'];
  const now = Date.now();
  return saveDeck(
    normalize({ ...src, id: newId(), slides, cells, createdAt: now, updatedAt: now }),
  );
}

function sniffType(b: Uint8Array): string {
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return 'application/octet-stream';
}

export function download(blob: Blob, filename: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function safeFilename(name: string): string {
  return name.replace(/[^\w\- ]+/g, '').trim() || 'deck';
}

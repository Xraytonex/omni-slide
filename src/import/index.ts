import { appendRow } from '../model/grid';
import type { Deck } from '../model/types';
import { saveDeck } from '../storage/db';
import type { Progress } from './pdf';

export type { Progress };

export function isPdf(f: File): boolean {
  return f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
}

/** Import each PDF as its own new row at the bottom of the deck, saving after every file. */
export async function importFiles(
  deck: Deck,
  files: File[],
  onProgress?: (p: Progress) => void,
): Promise<Deck> {
  const pdfs = files.filter(isPdf);
  if (pdfs.length === 0) return deck;
  // pdf.js is large; only load it when someone actually imports a PDF.
  const { importPdf } = await import('./pdf');
  for (const f of pdfs) {
    const slides = await importPdf(f, onProgress);
    deck = await saveDeck(appendRow(deck, slides));
  }
  return deck;
}

export function filesFromDrop(e: React.DragEvent): File[] {
  return Array.from(e.dataTransfer.files).filter(isPdf);
}

export function hasFiles(e: React.DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes('Files');
}

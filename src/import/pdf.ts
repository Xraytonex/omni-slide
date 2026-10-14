// The legacy build bundles polyfills (e.g. Map.getOrInsertComputed) that current browsers still lack.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type { Slide } from '../model/types';
import { newId, putAsset } from '../storage/db';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Long edge of the rendered page image, in pixels. */
const TARGET_PX = 1920;

export interface Progress {
  file: string;
  page: number;
  pages: number;
}

/** Render every page of a PDF to an image, store it, and return the new slides in page order. */
export async function importPdf(file: File, onProgress?: (p: Progress) => void): Promise<Slide[]> {
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const slides: Slide[] = [];
  try {
    const doc = await task.promise;
    for (let i = 1; i <= doc.numPages; i++) {
      onProgress?.({ file: file.name, page: i, pages: doc.numPages });
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: TARGET_PX / Math.max(base.width, base.height),
      });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport }).promise;
      const blob = await toBlob(canvas);
      const assetId = newId();
      await putAsset(assetId, blob);
      slides.push({
        id: newId(),
        kind: 'image',
        assetId,
        width: canvas.width,
        height: canvas.height,
        source: `${file.name} p${i}`,
      });
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return slides;
}

async function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const webp = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.92));
  if (webp && webp.type === 'image/webp') return webp;
  const png = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!png) throw new Error('Could not encode page image');
  return png;
}

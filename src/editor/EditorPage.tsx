import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { filesFromDrop, hasFiles, importFiles, type Progress } from '../import';
import {
  insertColumn,
  insertRow,
  moveSlide,
  neighbor,
  posOf,
  removeSlide,
  setStart,
  step,
} from '../model/grid';
import type { Deck, Dir, Pos, SlideId } from '../model/types';
import { startPresenting } from '../present/start';
import { forgetAsset } from '../storage/assetUrl';
import { deleteAsset, getDeck, saveDeck } from '../storage/db';
import { download, exportDeck, safeFilename } from '../storage/file';
import ImportProgress from '../ui/ImportProgress';
import GridCanvas from './GridCanvas';

const ARROWS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

const ZOOM_KEY = 'omni.cellWidth';

function loadZoom(): number {
  try {
    return Number(localStorage.getItem(ZOOM_KEY)) || 220;
  } catch {
    return 220;
  }
}

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [deck, setDeck] = useState<Deck | null | undefined>(undefined);
  const [selected, setSelected] = useState<SlideId | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cellWidth, setCellWidth] = useState(loadZoom);
  const [dragOver, setDragOver] = useState(false);
  const pdfInput = useRef<HTMLInputElement>(null);
  const deckRef = useRef<Deck | null>(null);

  useEffect(() => {
    getDeck(id!).then((d) => {
      deckRef.current = d ?? null;
      setDeck(d ?? null);
    });
  }, [id]);

  useEffect(() => {
    try {
      localStorage.setItem(ZOOM_KEY, String(cellWidth));
    } catch {
      /* per-viewer convenience only */
    }
  }, [cellWidth]);

  const commit = useCallback((next: Deck) => {
    deckRef.current = next;
    setDeck(next);
    saveDeck(next);
  }, []);

  const selPos: Pos | null = deck && selected ? posOf(deck, selected) : null;

  const remove = useCallback(
    (p: Pos) => {
      const d = deckRef.current;
      if (!d) return;
      const id = d.cells[`${p.x},${p.y}`];
      const slide = id && d.slides[id];
      if (!slide) return;
      commit(removeSlide(d, p));
      deleteAsset(slide.assetId);
      forgetAsset(slide.assetId);
      setSelected(null);
    },
    [commit],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const d = deckRef.current;
      if (!d || (e.target as HTMLElement).closest('input, textarea')) return;
      const p = selected ? posOf(d, selected) : null;
      const dir = ARROWS[e.key];
      if (dir) {
        e.preventDefault();
        if (!p) {
          setSelected(d.cells[`${d.start.x},${d.start.y}`] ?? null);
        } else if (e.shiftKey) {
          commit(moveSlide(d, p, step(p, dir)));
        } else {
          const n = neighbor(d, p, dir);
          if (n) setSelected(d.cells[`${n.x},${n.y}`]);
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && p) {
        e.preventDefault();
        remove(p);
      } else if (e.key === 'Enter' && p) {
        startPresenting(navigate, d.id, p);
      } else if (e.key === 'Escape') {
        setSelected(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, commit, remove, navigate]);

  async function addPdfs(files: File[]) {
    if (!deckRef.current || files.length === 0) return;
    setError(null);
    try {
      const next = await importFiles(deckRef.current, files, setProgress);
      deckRef.current = next;
      setDeck(next);
    } catch (e) {
      setError(`Could not import PDF: ${(e as Error).message}`);
    } finally {
      setProgress(null);
    }
  }

  if (deck === undefined) return <div className="loading">Loading…</div>;
  if (deck === null)
    return (
      <div className="loading">
        Deck not found. <Link to="/">Back to decks</Link>
      </div>
    );

  const isEmpty = Object.keys(deck.cells).length === 0;

  return (
    <div
      className={`editor ${dragOver ? 'drag-over' : ''}`}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        addPdfs(filesFromDrop(e));
      }}
    >
      <header className="topbar">
        <Link to="/" className="back" aria-label="All decks">
          ←
        </Link>
        <input
          className="deck-title"
          aria-label="Deck name"
          value={deck.name}
          onChange={(e) => commit({ ...deck, name: e.target.value })}
        />
        <div className="spacer" />
        <label className="zoom">
          <span className="muted small">Zoom</span>
          <input
            type="range"
            min={100}
            max={480}
            step={10}
            value={cellWidth}
            onChange={(e) => setCellWidth(Number(e.target.value))}
          />
        </label>
        <button onClick={() => pdfInput.current?.click()}>Import PDF</button>
        <button
          onClick={async () => download(await exportDeck(deck), `${safeFilename(deck.name)}.omni`)}
        >
          Export
        </button>
        <button
          className="primary"
          disabled={isEmpty}
          onClick={() => startPresenting(navigate, deck.id)}
        >
          ▶ Present
        </button>
        <input
          ref={pdfInput}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          data-testid="pdf-input"
          onChange={(e) => {
            const fs = Array.from(e.target.files ?? []);
            e.target.value = '';
            addPdfs(fs);
          }}
        />
      </header>

      <div className="toolbar" aria-label="Slide actions">
        {selPos ? (
          <>
            <button onClick={() => commit(setStart(deck, selPos))}>Set as start</button>
            <button onClick={() => startPresenting(navigate, deck.id, selPos)}>
              Present from here
            </button>
            <span className="sep" />
            <button onClick={() => commit(insertRow(deck, selPos.y))}>+ Row above</button>
            <button onClick={() => commit(insertRow(deck, selPos.y + 1))}>+ Row below</button>
            <button onClick={() => commit(insertColumn(deck, selPos.x))}>+ Column left</button>
            <button onClick={() => commit(insertColumn(deck, selPos.x + 1))}>+ Column right</button>
            <span className="sep" />
            <button className="danger" onClick={() => remove(selPos)}>
              Delete
            </button>
          </>
        ) : (
          <span className="muted small">
            Drag slides to arrange them. ← → move along a row, ↑ ↓ along a column. Select a slide
            for more options; Shift + arrows moves it.
          </span>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <main className="canvas">
        {isEmpty ? (
          <div className="empty-state">
            <h2>No slides yet</h2>
            <p className="muted">Drop a PDF here or import one. Each page becomes a slide.</p>
            <button className="primary" onClick={() => pdfInput.current?.click()}>
              Import PDF
            </button>
          </div>
        ) : (
          <GridCanvas
            deck={deck}
            cellWidth={cellWidth}
            selected={selected}
            onSelect={setSelected}
            onMove={(from, to) => commit(moveSlide(deck, from, to))}
            onOpen={(p) => startPresenting(navigate, deck.id, p)}
          />
        )}
      </main>
      <ImportProgress progress={progress} />
    </div>
  );
}

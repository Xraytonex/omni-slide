import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { filesFromDrop, hasFiles, importFiles, type Progress } from '../import';
import { slideAt } from '../model/grid';
import type { Deck } from '../model/types';
import { startPresenting } from '../present/start';
import { createDeck, deleteDeck, listDecks, saveDeck } from '../storage/db';
import { download, exportDeck, importDeckFile, safeFilename } from '../storage/file';
import ImportProgress from '../ui/ImportProgress';
import SlideImage from '../ui/SlideImage';

export default function HomePage() {
  const navigate = useNavigate();
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const omniInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);

  const refresh = () => listDecks().then(setDecks);
  useEffect(() => {
    refresh();
  }, []);

  async function newDeck() {
    const d = await createDeck('Untitled deck');
    navigate(`/deck/${d.id}`);
  }

  async function newDeckFromPdfs(files: File[]) {
    if (files.length === 0) return;
    setError(null);
    const name = files[0].name.replace(/\.pdf$/i, '');
    let d = await createDeck(name);
    try {
      d = await importFiles(d, files, setProgress);
      navigate(`/deck/${d.id}`);
    } catch (e) {
      setError(`Could not import PDF: ${(e as Error).message}`);
      refresh();
    } finally {
      setProgress(null);
    }
  }

  async function importOmni(file: File) {
    setError(null);
    try {
      await importDeckFile(file);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function rename(d: Deck) {
    const name = prompt('Rename deck', d.name)?.trim();
    if (!name || name === d.name) return;
    await saveDeck({ ...d, name });
    refresh();
  }

  async function remove(d: Deck) {
    if (!confirm(`Delete "${d.name}"? This cannot be undone.`)) return;
    await deleteDeck(d);
    refresh();
  }

  async function exportOne(d: Deck) {
    download(await exportDeck(d), `${safeFilename(d.name)}.omni`);
  }

  return (
    <div
      className={`home ${dragOver ? 'drag-over' : ''}`}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const omni = Array.from(e.dataTransfer.files).find((f) => f.name.endsWith('.omni'));
        if (omni) importOmni(omni);
        else newDeckFromPdfs(filesFromDrop(e));
      }}
    >
      <header className="topbar">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={22} height={22} />
          Omni Slide
        </div>
        <div className="spacer" />
        <button onClick={() => omniInput.current?.click()}>Open .omni file</button>
        <button onClick={() => pdfInput.current?.click()}>New from PDF</button>
        <button className="primary" onClick={newDeck}>
          New deck
        </button>
        <input
          ref={omniInput}
          type="file"
          accept=".omni,application/zip"
          hidden
          data-testid="omni-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) importOmni(f);
          }}
        />
        <input
          ref={pdfInput}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          data-testid="home-pdf-input"
          onChange={(e) => {
            const fs = Array.from(e.target.files ?? []);
            e.target.value = '';
            newDeckFromPdfs(fs);
          }}
        />
      </header>

      <main className="home-main">
        {error && <div className="error">{error}</div>}
        {decks && decks.length === 0 && (
          <div className="empty-state">
            <h1>Presentations that move in four directions</h1>
            <p className="muted">
              Lay slides out on a grid. When presenting, ← → move along a row and ↑ ↓ move along a
              column. Drop a PDF anywhere on this page to get started.
            </p>
            <button className="primary" onClick={() => pdfInput.current?.click()}>
              Import a PDF
            </button>
          </div>
        )}
        <ul className="deck-list">
          {decks?.map((d) => (
            <li key={d.id} className="deck-card">
              <Link to={`/deck/${d.id}`} className="deck-thumb" aria-label={`Open ${d.name}`}>
                <SlideImage slide={slideAt(d, d.start)} />
              </Link>
              <div className="deck-meta">
                <Link to={`/deck/${d.id}`} className="deck-name">
                  {d.name}
                </Link>
                <div className="muted small">
                  {Object.keys(d.slides).length} slides · {new Date(d.updatedAt).toLocaleString()}
                </div>
              </div>
              <div className="deck-actions">
                <button
                  className="primary"
                  disabled={Object.keys(d.slides).length === 0}
                  onClick={() => startPresenting(navigate, d.id)}
                >
                  Present
                </button>
                <button onClick={() => rename(d)}>Rename</button>
                <button onClick={() => exportOne(d)}>Export</button>
                <button className="danger" onClick={() => remove(d)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </main>
      <ImportProgress progress={progress} />
    </div>
  );
}

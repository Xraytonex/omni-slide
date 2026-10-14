import type { Progress } from '../import';

export default function ImportProgress({ progress }: { progress: Progress | null }) {
  if (!progress) return null;
  return (
    <div className="overlay" role="status" aria-live="polite">
      <div className="overlay-card">
        <div>Importing {progress.file}</div>
        <div className="muted">
          Page {progress.page} of {progress.pages}
        </div>
        <progress value={progress.page} max={progress.pages} />
      </div>
    </div>
  );
}

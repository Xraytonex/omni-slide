import type { NavigateFunction } from 'react-router-dom';
import type { Pos } from '../model/types';

/**
 * Enter present mode. Must be called from a user gesture so the fullscreen request is allowed.
 */
export function startPresenting(navigate: NavigateFunction, deckId: string, at?: Pos): void {
  document.documentElement.requestFullscreen?.().catch(() => {});
  const q = at ? `?x=${at.x}&y=${at.y}` : '';
  navigate(`/deck/${deckId}/present${q}`);
}

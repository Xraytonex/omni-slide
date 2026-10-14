import { DIRS, neighbor } from '../model/grid';
import type { Deck, Pos, Slide } from '../model/types';
import SlideImage from '../ui/SlideImage';

interface Props {
  deck: Deck;
  pos: Pos;
  /** Position inside the rendered grid (0-based, excluding the empty border ring). */
  gridPos: Pos;
  slide: Slide | undefined;
  selected: boolean;
  isStart: boolean;
  dropTarget: boolean;
  dragging: boolean;
}

export default function SlideCell({
  deck,
  pos,
  gridPos,
  slide,
  selected,
  isStart,
  dropTarget,
  dragging,
}: Props) {
  const cls = [
    'cell',
    slide ? 'filled' : 'empty',
    selected && 'selected',
    dropTarget && 'drop-target',
    dragging && 'dragging',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={cls}
      data-cell={`${pos.x},${pos.y}`}
      data-slide={slide?.id}
      style={{ gridColumn: gridPos.x + 2, gridRow: gridPos.y + 2 }}
    >
      {slide && (
        <>
          <SlideImage slide={slide} />
          {isStart && <span className="badge start-badge">Start</span>}
          {DIRS.map((d) => neighbor(deck, pos, d) && <span key={d} className={`link link-${d}`} />)}
        </>
      )}
    </div>
  );
}

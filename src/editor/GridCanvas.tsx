import { useEffect, useRef, useState } from 'react';
import { bounds, key, parseKey, samePos, slideAt } from '../model/grid';
import type { Deck, Pos, SlideId } from '../model/types';
import SlideImage from '../ui/SlideImage';
import SlideCell from './SlideCell';

interface Props {
  deck: Deck;
  cellWidth: number;
  selected: SlideId | null;
  onSelect: (id: SlideId | null) => void;
  onMove: (from: Pos, to: Pos) => void;
  onOpen: (pos: Pos) => void;
}

interface Drag {
  from: Pos;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
  over: Pos | null;
}

const DRAG_THRESHOLD = 5;
/** Distance from the scroll container's edge at which dragging starts auto-scrolling. */
const EDGE_PX = 48;
const EDGE_SPEED = 14;

function cellAt(x: number, y: number): Pos | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-cell]');
  return el ? parseKey(el.dataset.cell!) : null;
}

export default function GridCanvas({ deck, cellWidth, selected, onSelect, onMove, onOpen }: Props) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const update = (d: Drag | null) => {
    dragRef.current = d;
    setDrag(d);
  };

  // One ring of empty cells around the content so slides can be dropped anywhere next to it.
  const b = bounds(deck) ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const cols = b.maxX - b.minX + 3;
  const rows = b.maxY - b.minY + 3;
  const cells: Pos[] = [];
  for (let y = b.minY - 1; y <= b.maxY + 1; y++)
    for (let x = b.minX - 1; x <= b.maxX + 1; x++) cells.push({ x, y });

  const cellHeight = Math.round((cellWidth * 9) / 16);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const pos = cellAt(e.clientX, e.clientY);
    const slide = pos && slideAt(deck, pos);
    if (!pos || !slide) {
      onSelect(null);
      return;
    }
    onSelect(slide.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    update({
      from: pos,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      active: false,
      over: null,
    });
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const active =
      d.active || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > DRAG_THRESHOLD;
    update({
      ...d,
      x: e.clientX,
      y: e.clientY,
      active,
      over: active ? cellAt(e.clientX, e.clientY) : null,
    });
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    update(null);
    if (d.active && d.over && !samePos(d.over, d.from)) onMove(d.from, d.over);
  }

  // Auto-scroll the canvas while dragging near its edges.
  const dragging = !!drag?.active;
  useEffect(() => {
    if (!dragging) return;
    let raf = 0;
    const tick = () => {
      const d = dragRef.current;
      const scroller = document.querySelector<HTMLElement>('.canvas');
      if (d && scroller) {
        const r = scroller.getBoundingClientRect();
        const edge = (pos: number, lo: number, hi: number) =>
          pos < lo + EDGE_PX ? -EDGE_SPEED : pos > hi - EDGE_PX ? EDGE_SPEED : 0;
        const dx = edge(d.x, r.left, r.right);
        const dy = edge(d.y, r.top, r.bottom);
        if (dx || dy) {
          scroller.scrollBy(dx, dy);
          update({ ...d, over: cellAt(d.x, d.y) });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dragging]);

  const dragSlide = drag?.active ? slideAt(deck, drag.from) : undefined;

  return (
    <div
      className={`grid ${drag?.active ? 'is-dragging' : ''}`}
      style={{
        gridTemplateColumns: `repeat(${cols}, ${cellWidth}px)`,
        gridTemplateRows: `repeat(${rows}, ${cellHeight}px)`,
      }}
      data-testid="grid"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => update(null)}
      onDoubleClick={(e) => {
        const p = cellAt(e.clientX, e.clientY);
        if (p && slideAt(deck, p)) onOpen(p);
      }}
    >
      {cells.map((p) => {
        const slide = slideAt(deck, p);
        return (
          <SlideCell
            key={key(p)}
            deck={deck}
            pos={p}
            gridPos={{ x: p.x - b.minX, y: p.y - b.minY }}
            slide={slide}
            selected={!!slide && slide.id === selected}
            isStart={samePos(p, deck.start)}
            dropTarget={!!drag?.active && !!drag.over && samePos(drag.over, p)}
            dragging={!!drag?.active && samePos(drag.from, p)}
          />
        );
      })}
      {dragSlide && drag && (
        <div
          className="drag-ghost"
          style={{
            width: cellWidth,
            height: cellHeight,
            transform: `translate(${drag.x - cellWidth / 2}px, ${drag.y - cellHeight / 2}px)`,
          }}
        >
          <SlideImage slide={dragSlide} />
        </div>
      )}
    </div>
  );
}

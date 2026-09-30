"use client";

import { Fragment, useState, type PointerEvent, type ReactNode } from "react";

export type GripProps = {
  onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (e: PointerEvent<HTMLButtonElement>) => void;
};

type Drag = { index: number; startY: number; dy: number; insert: number };

// Liste verticale triable par poignée ☰ : la ligne suit le pointeur, les autres
// ne bougent pas, et une barre lumineuse marque le point d'insertion.
export default function SortableList<T>({
  items,
  onReorder,
  renderItem,
}: {
  items: T[];
  onReorder: (next: T[]) => void;
  renderItem: (item: T, grip: GripProps) => ReactNode;
}) {
  const [listEl, setListEl] = useState<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  function computeInsert(clientY: number): number {
    const rows = Array.from(listEl?.querySelectorAll<HTMLElement>("[data-row]") ?? []);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return i;
    }
    return rows.length;
  }

  function endDrag() {
    const d = drag;
    setDrag(null);
    if (!d) return;
    let insert = d.insert;
    if (insert > d.index) insert -= 1;
    if (insert === d.index) return;
    const next = items.slice();
    const [moved] = next.splice(d.index, 1);
    next.splice(insert, 0, moved);
    onReorder(next);
  }

  function grip(index: number): GripProps {
    return {
      onPointerDown: (e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag({ index, startY: e.clientY, dy: 0, insert: index });
      },
      onPointerMove: (e) =>
        setDrag((d) => (d ? { ...d, dy: e.clientY - d.startY, insert: computeInsert(e.clientY) } : d)),
      onPointerUp: () => endDrag(),
      onPointerCancel: () => endDrag(),
    };
  }

  const indicator = (
    <div className="h-1 rounded-full bg-[var(--gold-bright)] shadow-[0_0_8px_var(--gold-bright)]" />
  );

  return (
    <div ref={setListEl} className="flex flex-col gap-2">
      {items.map((item, i) => (
        <Fragment key={i}>
          {drag && drag.insert === i && indicator}
          <div
            data-row
            className={drag && i === drag.index ? "relative z-20 opacity-95 shadow-[4px_4px_0_rgba(0,0,0,0.6)]" : "relative"}
            style={drag && i === drag.index ? { transform: `translateY(${drag.dy}px)` } : undefined}
          >
            {renderItem(item, grip(i))}
          </div>
        </Fragment>
      ))}
      {drag && drag.insert === items.length && indicator}
    </div>
  );
}

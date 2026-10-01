"use client";

import { Fragment, useEffect, useState, type PointerEvent, type ReactNode } from "react";

export type GripProps = {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: PointerEvent<HTMLElement>) => void;
};

type Drag = { index: number; startY: number; dy: number; insert: number; clientY: number };

// Liste verticale triable par poignée ☰ : la ligne suit le pointeur, les autres
// ne bougent pas, et une barre lumineuse marque le point d'insertion.
export default function SortableList<T>({
  items,
  onReorder,
  renderItem,
}: {
  items: T[];
  onReorder: (next: T[]) => void;
  renderItem: (item: T, grip: GripProps, index: number) => ReactNode;
}) {
  const [listEl, setListEl] = useState<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  function computeInsert(clientY: number, dragIndex: number, dy: number): number {
    const rows = Array.from(listEl?.querySelectorAll<HTMLElement>("[data-row]") ?? []);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect();
      // La ligne déplacée est déjà translatée de dy : on compense pour retrouver
      // sa position d'origine. Sinon son milieu « suit » le pointeur — glisser
      // vers le bas ne pouvait jamais faire avancer l'insertion.
      const top = i === dragIndex ? r.top - dy : r.top;
      if (clientY < top + r.height / 2) return i;
    }
    return rows.length;
  }

  // Scroll doux quand le doigt approche le haut/bas du conteneur scrollable.
  useEffect(() => {
    if (!drag || !listEl) return;
    let scroller: HTMLElement | null = null;
    for (let p = listEl.parentElement; p && !scroller; p = p.parentElement) {
      const oy = getComputedStyle(p).overflowY;
      if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) scroller = p;
    }
    const el = scroller;
    const id = setInterval(() => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const edge = 48;
      setDrag((d) => {
        if (!d) return d;
        const y = d.clientY;
        if (y < r.top + edge) el.scrollTop -= Math.ceil((r.top + edge - y) / 4);
        else if (y > r.bottom - edge) el.scrollTop += Math.ceil((y - (r.bottom - edge)) / 4);
        else return d;
        // La liste défile sous un doigt immobile : le point d'insertion doit suivre.
        return { ...d, insert: computeInsert(y, d.index, d.dy) };
      });
    }, 16);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null]);

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
    // Peut être appelé par un vrai pointerdown (poignée) ou par un détecteur de
    // direction une fois le geste vertical confirmé (corps de ligne draggable).
    const start = (e: PointerEvent<HTMLElement>) => {
      e.stopPropagation();
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ index, startY: e.clientY, dy: 0, insert: index, clientY: e.clientY });
    };
    return {
      onPointerDown: start,
      onPointerMove: (e) => {
        setDrag((d) => {
          if (!d) return d;
          const dy = e.clientY - d.startY;
          return { ...d, dy, clientY: e.clientY, insert: computeInsert(e.clientY, d.index, dy) };
        });
      },
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
            {renderItem(item, grip(i), i)}
          </div>
        </Fragment>
      ))}
      {drag && drag.insert === items.length && indicator}
    </div>
  );
}

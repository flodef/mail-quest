"use client";

import { Fragment, useEffect, useState, type PointerEvent, type ReactNode } from "react";

export type GripProps = {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: PointerEvent<HTMLElement>) => void;
};

type Drag = { index: number; startY: number; dy: number; insert: number; clientY: number; scrollDelta: number };

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
    const startScrollTop = el?.scrollTop ?? 0;
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
        // La liste défile sous le doigt : il faut aussi compenser dy du delta
        // de scroll, sinon la ligne « reste derrière » pendant que le point
        // d'insertion (basé sur clientY) continue de descendre.
        const scrollDelta = el.scrollTop - startScrollTop;
        const dy = y - d.startY + scrollDelta;
        return { ...d, scrollDelta, dy, insert: computeInsert(y, d.index, dy) };
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
      setDrag({ index, startY: e.clientY, dy: 0, insert: index, clientY: e.clientY, scrollDelta: 0 });
    };
    return {
      onPointerDown: start,
      onPointerMove: (e) => {
        setDrag((d) => {
          if (!d) return d;
          // dy = mouvement du pointeur + scroll subi depuis le début du drag —
          // sinon la ligne dérive par rapport au doigt quand la liste défile.
          const dy = e.clientY - d.startY + d.scrollDelta;
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
        // Clé stable par id : un re-render/reordonnancement ne doit pas faire
        // migrer l'état local d'une ligne (ex. mode édition) vers une autre.
        <Fragment key={(item as { id?: string }).id ?? i}>
          {/* Pas d'indicateur aux positions neutres : insert === index (avant
              soi) ou index+1 (après soi) laissent l'item à la même place —
              afficher la barre à ces endroits suggérait un faux déplacement. */}
          {drag && drag.insert === i && drag.insert !== drag.index && drag.insert !== drag.index + 1 && indicator}
          <div
            data-row
            className={drag && i === drag.index ? "relative z-20 opacity-95 shadow-[4px_4px_0_rgba(0,0,0,0.6)]" : "relative"}
            style={drag && i === drag.index ? { transform: `translateY(${drag.dy}px)` } : undefined}
          >
            {renderItem(item, grip(i), i)}
          </div>
        </Fragment>
      ))}
      {drag && drag.insert === items.length && items.length !== drag.index + 1 && indicator}
    </div>
  );
}

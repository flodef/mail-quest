"use client";

import { useState } from "react";
import {
  IconArrowBackUp,
  IconChevronDown,
  IconGripVertical,
  IconLock,
  IconPaperclip,
  IconSkull,
  IconTrash,
  IconVolumeOff,
  IconWand,
  IconX,
} from "@tabler/icons-react";
import InboxRow, { fmtDate } from "@/components/InboxRow";
import Sheet from "@/components/Sheet";
import SortableList from "@/components/SortableList";
import type { InboxItem, MutedEntry, OverviewAccount } from "@/lib/types";

type MsgAction = "generate" | "mute" | "delete" | "deleteAll" | "deleteAllGo" | "unmute";
type TrashAction = "restore" | "purge";

/** Tiroir inbox d'un compte : missives triables, potence (corbeille IMAP),
    correspondants bannis (repliés), verrouillage de l'app. */
export default function InboxDrawer({
  inbox,
  items,
  muted,
  trash,
  busy,
  onClose,
  onOpen,
  onReorder,
  onAction,
  onLoadTrash,
  onTrashAction,
  onPurgeTrash,
  onLogout,
}: {
  inbox: OverviewAccount;
  /** Missives déjà ordonnées (ordre joueur + nouveautés en tête). */
  items: InboxItem[];
  muted: MutedEntry[];
  trash: InboxItem[] | null;
  busy: boolean;
  onClose: () => void;
  onOpen: (m: InboxItem) => void;
  onReorder: (next: InboxItem[]) => void;
  onAction: (m: InboxItem, action: MsgAction) => void;
  onLoadTrash: () => void;
  onTrashAction: (m: InboxItem, action: TrashAction) => void;
  onPurgeTrash: () => void;
  onLogout: () => void;
}) {
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [mutedOpen, setMutedOpen] = useState(false);
  const mutedHere = muted.filter((mm) => mm.account === inbox.id);

  const toggleTrash = () => {
    if (!trashOpen) onLoadTrash();
    setTrashOpen((o) => !o);
  };

  return (
    <Sheet onClose={onClose} panelClass="max-h-[70dvh]" onPanelClick={() => setMenuFor(null)}>
      <div className="flex justify-between items-center">
        <div className="font-pixel text-[9px]" style={{ color: inbox.color }}>{inbox.label}</div>
        <button className="btn-pixel ghost !px-2" onClick={onClose}>✕</button>
      </div>
      <SortableList
        items={items}
        onReorder={onReorder}
        renderItem={(m, grip) => (
          <div className="relative">
            {/* Poignée HORS de la zone swipe (framer-motion) : sinon le
                drag horizontal capte le pointeur et le tri vertical casse. */}
            <button
              {...grip}
              className="absolute left-0 top-0 bottom-0 w-6 z-10 flex items-center justify-center opacity-50 cursor-grab active:cursor-grabbing touch-none"
              aria-label="Réordonner"
            >
              <IconGripVertical size={16} />
            </button>
            <div className="pl-6">
              <InboxRow
                disabled={busy}
                onOpen={() => onOpen(m)}
                onToggleMenu={() => setMenuFor(menuFor === m.uid ? null : m.uid)}
                onGenerate={() => onAction(m, "generate")}
                onDelete={() => onAction(m, "delete")}
              >
                <div className="flex items-baseline gap-2 pr-8">
                  <div className="text-lg leading-tight flex-1 min-w-0">{m.from}</div>
                  {m.hasAttachment && <IconPaperclip size={14} className="shrink-0 opacity-60" />}
                  <div className="font-pixel text-[6px] opacity-50 shrink-0 pr-6">{fmtDate(m.date)}</div>
                </div>
                <div className="opacity-80 pr-8">{m.subject}</div>
              </InboxRow>
              {menuFor === m.uid && (
                <div
                  ref={(el) => el?.scrollIntoView({ block: "nearest", behavior: "smooth" })}
                  className="absolute right-0 top-full z-50 panel p-1.5 flex flex-col gap-1 min-w-[240px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button className="btn-pixel ghost !py-2 !px-2 text-[8px] flex items-center gap-2 justify-start text-left" onClick={() => { setMenuFor(null); onAction(m, "generate"); }}>
                    <IconWand size={18} /> Forger une missive
                  </button>
                  <button className="btn-pixel ghost !py-2 !px-2 text-[8px] flex items-center gap-2 justify-start text-left" onClick={() => { setMenuFor(null); onAction(m, "mute"); }}>
                    <IconVolumeOff size={18} /> Bannir ce correspondant
                  </button>
                  <button className="btn-pixel ghost !py-2 !px-2 text-[8px] flex items-center gap-2 justify-start text-left text-[var(--ruby)]" onClick={() => { setMenuFor(null); onAction(m, "delete"); }}>
                    <IconTrash size={18} /> Jeter à la potence
                  </button>
                  <button className="btn-pixel ghost !py-2 !px-2 text-[8px] flex items-center gap-2 justify-start text-left text-[var(--ruby)]" onClick={() => { setMenuFor(null); onAction(m, "deleteAll"); }}>
                    <IconTrash size={18} /> Tout jeter de ce correspondant
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      />
      {items.length === 0 && !inbox.error && <div className="opacity-60 py-4 text-center">Aucune missive dans cette boîte.</div>}
      {inbox.error && <div className="text-[var(--ruby)]">Erreur : boîte injoignable.</div>}

      {/* Potence : corbeille IMAP du compte (voir / ressusciter / purger) */}
      <div className="mt-3 pt-3 border-t border-[#2a4a2a]">
        <button
          className="btn-pixel ghost w-full flex items-center justify-center gap-1.5 !py-1.5 font-pixel text-[7px]"
          onClick={toggleTrash}
        >
          <IconChevronDown size={14} className={`transition-transform ${trashOpen ? "rotate-180" : ""}`} />
          POTENCE
        </button>
        {trashOpen && (
          <div className="flex flex-col gap-1.5 mt-2">
            {trash === null && <div className="opacity-60 py-2 text-center">On hisse la potence…</div>}
            {trash !== null && trash.length === 0 && <div className="opacity-60 py-2 text-center">La potence est vide.</div>}
            {trash !== null && trash.length > 0 && (
              <>
                <button className="btn-pixel danger !py-1.5 !px-2 text-[8px] self-end flex items-center gap-1" disabled={busy} onClick={onPurgeTrash}>
                  <IconSkull size={14} /> Tout purger ({trash.length})
                </button>
                {trash.map((m) => (
                  <div key={m.uid} className="flex items-center gap-3 bg-[var(--shadow)] p-2.5 border border-[#3a5a2a] opacity-70">
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-base leading-tight">{m.from} — {m.subject}</div>
                      <div className="font-pixel text-[6px] opacity-60">{fmtDate(m.date)}</div>
                    </div>
                    <button className="btn-pixel ghost !py-1.5 !px-2" title="Ressusciter (retour boîte)" disabled={busy} onClick={() => onTrashAction(m, "restore")}>
                      <IconArrowBackUp size={16} />
                    </button>
                    <button className="btn-pixel danger !py-1.5 !px-2" title="Réduire en cendres" disabled={busy} onClick={() => onTrashAction(m, "purge")}>
                      <IconTrash size={16} />
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Correspondants bannis — repliés par défaut */}
      {mutedHere.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#2a4a2a]">
          <button
            className="btn-pixel ghost w-full flex items-center justify-center gap-1.5 !py-1.5 font-pixel text-[7px]"
            onClick={() => setMutedOpen((o) => !o)}
          >
            <IconChevronDown size={14} className={`transition-transform ${mutedOpen ? "rotate-180" : ""}`} />
            {mutedHere.length} CORRESPONDANT(S) BANNI(S)
          </button>
          {mutedOpen &&
            mutedHere.map((mm) => (
              <div key={mm.sender} className="flex items-center justify-between py-1.5 text-sm opacity-70">
                <span className="truncate">{mm.sender}</span>
                <button
                  className="btn-pixel ghost !px-1.5 !py-1"
                  title="Gracier"
                  onClick={() => onAction({ account: mm.account, uid: 0, from: mm.sender, fromEmail: mm.sender, subject: "", date: null, unread: false }, "unmute")}
                >
                  <IconX size={13} />
                </button>
              </div>
            ))}
        </div>
      )}

      {/* Verrouillage : coupe la session serveur et purge le snapshot local. */}
      <div className="mt-3 pt-3 border-t border-[#2a4a2a] flex justify-center">
        <button className="btn-pixel ghost !py-1.5 !px-3 font-pixel text-[7px] flex items-center gap-1.5 opacity-70 hover:opacity-100" onClick={onLogout} title="Verrouiller l'app">
          <IconLock size={14} /> VERROUILLER
        </button>
      </div>
    </Sheet>
  );
}

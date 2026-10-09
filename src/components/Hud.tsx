"use client";

import { IconMail, IconHourglass } from "@tabler/icons-react";

import type { AccountBadge } from "@/lib/types";

export default function Hud({ accounts, onAccountTap }: { accounts: AccountBadge[]; onAccountTap: (id: string) => void }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(accounts.length, 1)}, minmax(0, 1fr))` }}>
      {accounts.map((a) => (
        <button
          key={a.id}
          onClick={() => onAccountTap(a.id)}
          className="panel px-1.5 py-1.5 flex flex-col items-stretch gap-1 min-w-0"
          title={a.label}
        >
          <span className="font-pixel text-[6px] uppercase opacity-80 truncate text-center leading-tight">{a.id}</span>
          <span className="flex items-center justify-center gap-1.5 text-sm">
            <span className="w-2.5 h-2.5 rounded-[2px] shrink-0" style={{ background: a.color }} />
            <span className="flex items-center gap-0.5">
              <IconMail size={13} /> {a.error ? "!" : (a.unseen ?? 0)}
            </span>
            <span className="flex items-center gap-0.5 text-[var(--gold-bright)]">
              <IconHourglass size={13} /> {a.draftCount ?? 0}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

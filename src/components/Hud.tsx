"use client";

import { IconMail, IconHourglass } from "@tabler/icons-react";

export interface AccountBadge {
  id: string;
  label: string;
  color: string;
  unseen?: number;
  draftCount?: number;
  asideCount?: number;
  error?: string;
}

export default function Hud({ accounts, onAccountTap }: { accounts: AccountBadge[]; onAccountTap: (id: string) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {accounts.map((a) => (
        <button
          key={a.id}
          onClick={() => onAccountTap(a.id)}
          className="panel px-3 py-2 flex items-center gap-3 shrink-0 min-w-[110px]"
          title={a.label}
        >
          <span className="w-3 h-3 rounded-[2px]" style={{ background: a.color }} />
          <span className="flex flex-col items-start leading-tight">
            <span className="font-pixel text-[7px] uppercase opacity-80">{a.id}</span>
            <span className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-0.5">
                <IconMail size={14} /> {a.error ? "!" : (a.unseen ?? 0)}
              </span>
              <span className="flex items-center gap-0.5 text-[var(--gold-bright)]">
                <IconHourglass size={14} /> {a.draftCount ?? 0}
              </span>
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

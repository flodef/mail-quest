import { NextResponse, after } from "next/server";
import { getAccounts } from "@/lib/mail/accounts";
import { fetchAccount } from "@/lib/mail/imap";
import { dbReady, listAsides, listMuted } from "@/lib/db";
import { cachedMail } from "@/lib/cache";
import { checkReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

const TTL_MS = 60_000;

export async function GET() {
  // Rappels agenda : check paresseux à l'usage de l'app (throttlé dans checkReminders)
  after(() => checkReminders().catch(() => {}));
  const data = await cachedMail("overview", TTL_MS, async () => {
    const accounts = getAccounts();
    const [asideRows, mutedRows] = dbReady()
      ? await Promise.all([listAsides().catch(() => []), listMuted().catch(() => [])])
      : [[], []];
    const asides = new Set(asideRows.map((a) => `${a.account}:${a.uid}`));
    const muted = new Set(mutedRows.map((m) => `${m.account}:${m.sender}`));
    const mutedFor = (id: string) => mutedRows.filter((m) => m.account === id).map((m) => m.sender);
    const results = await Promise.allSettled(
      accounts.map(async (acc) => {
        const { stats, drafts } = await fetchAccount(acc, mutedFor(acc.id));
        const latest = stats.latest.filter((m) => !muted.has(`${acc.id}:${m.fromEmail}`));
        const active = drafts.filter((d) => !asides.has(`${acc.id}:${d.uid}`));
        return {
          id: acc.id,
          label: acc.label,
          color: acc.color,
          unseen: Math.max(0, stats.unseen - stats.mutedUnseen),
          draftCount: active.length,
          asideCount: drafts.length - active.length,
          latest,
          active,
          aside: drafts.filter((d) => asides.has(`${acc.id}:${d.uid}`)),
        };
      }),
    );
    return {
      accounts: results.map((r, i) =>
        r.status === "fulfilled"
          ? r.value
          : { id: accounts[i].id, label: accounts[i].label, color: accounts[i].color, error: String(r.reason?.message ?? r.reason), active: [], aside: [] },
      ),
      muted: mutedRows,
    };
  });
  return NextResponse.json(data);
}

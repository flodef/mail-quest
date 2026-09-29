import { NextResponse } from "next/server";
import { getAccounts } from "@/lib/mail/accounts";
import { inboxStats, listDrafts } from "@/lib/mail/imap";
import { dbReady, listAsides, listMuted } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const accounts = getAccounts();
  const [asideRows, mutedRows] = dbReady()
    ? await Promise.all([listAsides().catch(() => []), listMuted().catch(() => [])])
    : [[], []];
  const asides = new Set(asideRows.map((a) => `${a.account}:${a.uid}`));
  const muted = new Set(mutedRows.map((m) => `${m.account}:${m.sender}`));
  const results = await Promise.allSettled(
    accounts.map(async (acc) => {
      const [stats, drafts] = await Promise.all([inboxStats(acc), listDrafts(acc)]);
      const latest = stats.latest.filter((m) => !muted.has(`${acc.id}:${m.fromEmail}`));
      return {
        id: acc.id,
        label: acc.label,
        color: acc.color,
        unseen: stats.unseen,
        draftCount: drafts.filter((d) => !asides.has(`${acc.id}:${d.uid}`)).length,
        asideCount: drafts.filter((d) => asides.has(`${acc.id}:${d.uid}`)).length,
        latest,
      };
    }),
  );
  return NextResponse.json({
    accounts: results.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { id: accounts[i].id, label: accounts[i].label, color: accounts[i].color, error: String(r.reason?.message ?? r.reason) },
    ),
    muted: mutedRows,
  });
}

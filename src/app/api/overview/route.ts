import { NextResponse } from "next/server";
import { getAccounts } from "@/lib/mail/accounts";
import { inboxStats, listDrafts } from "@/lib/mail/imap";
import { dbReady, listAsides } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const accounts = getAccounts();
  const asides = new Set((dbReady() ? await listAsides().catch(() => []) : []).map((a) => `${a.account}:${a.uid}`));
  const results = await Promise.allSettled(
    accounts.map(async (acc) => {
      const [stats, drafts] = await Promise.all([inboxStats(acc), listDrafts(acc)]);
      return {
        id: acc.id,
        label: acc.label,
        color: acc.color,
        unseen: stats.unseen,
        draftCount: drafts.filter((d) => !asides.has(`${acc.id}:${d.uid}`)).length,
        asideCount: drafts.filter((d) => asides.has(`${acc.id}:${d.uid}`)).length,
        latest: stats.latest,
      };
    }),
  );
  return NextResponse.json({
    accounts: results.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { id: accounts[i].id, label: accounts[i].label, color: accounts[i].color, error: String(r.reason?.message ?? r.reason) },
    ),
  });
}

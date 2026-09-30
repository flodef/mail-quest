import { NextResponse } from "next/server";
import { getAccount, getAccounts } from "@/lib/mail/accounts";
import { clearDraftsToTrash } from "@/lib/mail/imap";
import { dbReady, listAsides, removeAside } from "@/lib/db";

export async function POST() {
  if (!dbReady()) return NextResponse.json({ error: "db unavailable" }, { status: 503 });
  const asides = await listAsides();
  const accountIds = new Set(getAccounts().map((a) => a.id));
  const byAccount = new Map<string, number[]>();
  for (const a of asides) {
    if (!accountIds.has(a.account)) continue;
    byAccount.set(a.account, [...(byAccount.get(a.account) ?? []), a.uid]);
  }
  let cleared = 0;
  const errors: string[] = [];
  for (const [account, uids] of byAccount) {
    try {
      cleared += await clearDraftsToTrash(getAccount(account), uids);
      for (const uid of uids) await removeAside(account, uid);
    } catch (e) {
      errors.push(`${account}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return NextResponse.json({ ok: errors.length === 0, cleared, errors });
}

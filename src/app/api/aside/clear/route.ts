import { NextResponse } from "next/server";
import { getAccount, getAccounts } from "@/lib/mail/accounts";
import { clearDraftsToTrash } from "@/lib/mail/imap";
import { dbReady, listAsides, removeAside } from "@/lib/db";
import { invalidateMail } from "@/lib/cache";

export async function POST() {
  if (!dbReady()) return NextResponse.json({ error: "db unavailable" }, { status: 503 });
  // Échec DB → 500 explicite plutôt que "cleared: 0" (la jarre UI serait
  // vidée à tort).
  const asides = await listAsides().catch((e) => {
    console.error("[aside/clear]", e instanceof Error ? e.message : e);
    return null;
  });
  if (asides === null) return NextResponse.json({ error: "db error" }, { status: 500 });
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
      console.error("[aside/clear]", account, e instanceof Error ? e.message : e);
      errors.push(account);
    }
  }
  if (cleared > 0) invalidateMail();
  return NextResponse.json({ ok: errors.length === 0, cleared, errors });
}

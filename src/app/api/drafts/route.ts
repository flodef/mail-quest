import { NextResponse } from "next/server";
import { getAccounts } from "@/lib/mail/accounts";
import { listDrafts } from "@/lib/mail/imap";
import { dbReady, listAsides } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const asides = new Set((dbReady() ? await listAsides().catch(() => []) : []).map((a) => `${a.account}:${a.uid}`));
  const all = await Promise.allSettled(getAccounts().map((a) => listDrafts(a)));
  const drafts = all.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  return NextResponse.json({
    active: drafts.filter((d) => !asides.has(`${d.account}:${d.uid}`)),
    aside: drafts.filter((d) => asides.has(`${d.account}:${d.uid}`)),
  });
}

import { NextResponse } from "next/server";
import { getAccount, isKnownAccount } from "@/lib/mail/accounts";
import { accountView } from "@/lib/mail/accountView";
import { dbReady, listAsides, listMuted } from "@/lib/db";
import { internalError } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET ?account=x — relevé à la demande d'un seul compte (polling manuel pour
// les comptes "manual": true exclus du cron et de l'overview).
export async function GET(req: Request) {
  const account = new URL(req.url).searchParams.get("account") ?? "";
  if (!isKnownAccount(account)) {
    return NextResponse.json({ error: "account required" }, { status: 400 });
  }
  try {
    const [asideRows, mutedRows] = dbReady()
      ? await Promise.all([listAsides().catch(() => []), listMuted().catch(() => [])])
      : [[], []];
    return NextResponse.json(await accountView(getAccount(account), asideRows, mutedRows));
  } catch (e) {
    return internalError(e, "account");
  }
}

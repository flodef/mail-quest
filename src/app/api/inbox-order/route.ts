import { NextResponse } from "next/server";
import { dbReady, listInboxOrder, setInboxOrder } from "@/lib/db";
import { internalError, isUid, parseJson } from "@/lib/api";

export const dynamic = "force-dynamic";

const ORDER_MAX = 500;

export async function GET() {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  try {
    return NextResponse.json({ order: await listInboxOrder() });
  } catch (e) {
    return internalError(e, "inbox-order");
  }
}

export async function POST(req: Request) {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  const body = await parseJson(req);
  const account = typeof body?.account === "string" ? body.account : "";
  const uids = Array.isArray(body?.uids) ? body.uids.filter(isUid).slice(0, ORDER_MAX) : null;
  if (!account || !uids) return NextResponse.json({ error: "account + uids required" }, { status: 400 });
  try {
    await setInboxOrder(account, uids);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return internalError(e, "inbox-order");
  }
}

import { NextResponse } from "next/server";
import { dbReady, listInboxOrder, setInboxOrder } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  return NextResponse.json({ order: await listInboxOrder() });
}

export async function POST(req: Request) {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const account = typeof body.account === "string" ? body.account : "";
  const uids = Array.isArray(body.uids) ? body.uids.filter((u: unknown) => Number.isInteger(u)) : null;
  if (!account || !uids) return NextResponse.json({ error: "account + uids required" }, { status: 400 });
  await setInboxOrder(account, uids);
  return NextResponse.json({ ok: true });
}

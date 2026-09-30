import { NextResponse } from "next/server";
import { getAccounts } from "@/lib/mail/accounts";
import { inboxStats } from "@/lib/mail/imap";
import { dbReady, getLastSeen, listMuted, setLastSeen, initDb } from "@/lib/db";
import { notifyAll } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!dbReady()) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  }
  await initDb();
  const muted = new Set((await listMuted().catch(() => [])).map((m) => `${m.account}:${m.sender}`));
  const events: string[] = [];
  for (const acc of getAccounts()) {
    try {
      const stats = await inboxStats(acc);
      const prev = await getLastSeen(acc.id);
      const newest = stats.latest.find((m) => m.unread && !muted.has(`${acc.id}:${m.fromEmail}`));
      if (prev !== null && stats.unseen > prev && newest) {
        events.push(`${acc.label}: ${stats.unseen - prev} nouveau(x)`);
        await notifyAll(`📬 ${acc.label}`, `De: ${newest.from}\n${newest.subject}`);
      }
      await setLastSeen(acc.id, stats.unseen);
    } catch (e) {
      events.push(`${acc.id}: error ${e instanceof Error ? e.message : e}`);
    }
  }
  return NextResponse.json({ ok: true, events });
}

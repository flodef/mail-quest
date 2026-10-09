import { NextResponse } from "next/server";
import { dbReady } from "@/lib/db";
import { checkReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

// Endpoint de rappels agenda — à pinger régulièrement (toutes les ~15 min)
// depuis un cron externe (cron-job.org…) ou le cron Vercel quotidien.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!dbReady()) {
    return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  }
  const sent = await checkReminders(true);
  return NextResponse.json({ ok: true, sent });
}

import { NextResponse } from "next/server";
import { addTasks, dbReady, deleteTask, listTasks, purgeDoneTasks, reorderTasks, setTaskDone, taskToBottom } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  return NextResponse.json({ tasks: await listTasks() });
}

export async function POST(req: Request) {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const texts = Array.isArray(body.texts) ? body.texts : typeof body.text === "string" ? [body.text] : [];
  const added = await addTasks(texts.filter((t: unknown) => typeof t === "string"));
  return NextResponse.json({ ok: true, added });
}

export async function PATCH(req: Request) {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  if (Array.isArray(body.order)) {
    await reorderTasks(body.order.filter((id: unknown) => typeof id === "string"));
  } else if (typeof body.id === "string") {
    if (body.toBottom === true) await taskToBottom(body.id);
    else if (typeof body.done === "boolean") await setTaskDone(body.id, body.done);
    else return NextResponse.json({ error: "nothing to do" }, { status: 400 });
  } else {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  const url = new URL(req.url);
  if (url.searchParams.get("purge") === "1") {
    return NextResponse.json({ ok: true, purged: await purgeDoneTasks() });
  }
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteTask(id);
  return NextResponse.json({ ok: true });
}

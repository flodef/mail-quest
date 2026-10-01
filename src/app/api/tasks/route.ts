import { NextResponse } from "next/server";
import { addTasks, dbReady, deleteTask, listTasks, purgeDoneTasks, reorderTasks, setTaskDone, taskToBottom, updateTask } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  return NextResponse.json({ tasks: await listTasks() });
}

const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export async function POST(req: Request) {
  if (!dbReady()) return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const items: { text: string; id?: string }[] = [];
  if (Array.isArray(body.texts)) {
    for (const t of body.texts) {
      if (typeof t === "string") items.push({ text: t });
      else if (t && typeof t.text === "string") items.push({ text: t.text, id: isUuid(t.id) ? t.id : undefined });
    }
  }
  if (typeof body.text === "string") items.push({ text: body.text, id: isUuid(body.id) ? body.id : undefined });
  const added = await addTasks(items);
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
    else if (typeof body.text === "string" && body.text.trim()) await updateTask(body.id, body.text.trim());
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

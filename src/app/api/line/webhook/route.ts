// LINE webhook — รับ event จาก LINE แล้วส่งให้สมองบอท (commands.handleText)
import { verifySignature, reply, push } from "@/lib/line";
import { handleText } from "@/lib/commands";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response("EunJod (น้องจด) webhook is running ✅");
}

interface LineSource { type?: string; userId?: string; groupId?: string; roomId?: string }
interface LineEvent {
  type: string;
  replyToken?: string;
  source?: LineSource;
  message?: { type?: string; text?: string; id?: string };
}

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-line-signature");

  if (!verifySignature(raw, signature)) {
    return new Response("invalid signature", { status: 401 });
  }

  let body: { events?: LineEvent[] };
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const events = body.events ?? [];
  await Promise.all(events.map(handleEvent));
  return new Response("OK");
}

async function handleEvent(ev: LineEvent): Promise<void> {
  try {
    if (ev.type !== "message" || ev.message?.type !== "text") return;
    const src = ev.source ?? {};
    const sourceId = src.groupId || src.roomId || src.userId;
    if (!sourceId) return;
    const sourceType = src.groupId ? "group" : src.roomId ? "room" : "user";

    const out = await handleText({
      sourceId,
      sourceType,
      text: ev.message.text ?? "",
      userId: src.userId ?? null,
      messageId: ev.message.id ?? null,
    });

    if (out && out.length) {
      if (ev.replyToken) await reply(ev.replyToken, out);
      else await push(sourceId, out);
    }
  } catch (e) {
    console.error("[webhook] event error:", e);
  }
}

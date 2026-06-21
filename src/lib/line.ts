// line.ts — ตรวจลายเซ็น + ส่งข้อความกลับ LINE
import crypto from "node:crypto";

export interface QuickItem {
  label: string;
  text: string;
}
export interface LineMessage {
  type: "text";
  text: string;
  quickReply?: { items: { type: "action"; action: { type: "message"; label: string; text: string } }[] };
}

const LINE_API = "https://api.line.biz/v2/bot/message";

/** ตรวจลายเซ็น X-Line-Signature (HMAC-SHA256 ด้วย channel secret) */
export function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return true; // dev: ไม่ได้ตั้ง secret → ข้ามการตรวจ (อย่าใช้บน production)
  if (!signature) return false;
  const hash = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function text(message: string, quick?: QuickItem[]): LineMessage {
  const m: LineMessage = { type: "text", text: message };
  if (quick && quick.length) {
    m.quickReply = {
      items: quick.slice(0, 13).map((q) => ({
        type: "action",
        action: { type: "message", label: q.label.slice(0, 20), text: q.text },
      })),
    };
  }
  return m;
}

/** ปุ่มลัดมาตรฐานหลังจดรายการ */
export const DEFAULT_QUICK: QuickItem[] = [
  { label: "🗑️ ลบล่าสุด", text: "ลบ" },
  { label: "📅 เดือนนี้", text: "เดือนนี้" },
  { label: "📊 รายงาน", text: "รายงาน" },
  { label: "❓ ช่วยเหลือ", text: "/help" },
];

async function send(path: string, body: unknown): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.warn("[line] ไม่มี LINE_CHANNEL_ACCESS_TOKEN — ข้ามการส่ง:", JSON.stringify(body));
    return;
  }
  const res = await fetch(`${LINE_API}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("[line] ส่งไม่สำเร็จ", res.status, await res.text().catch(() => ""));
  }
}

export function reply(replyToken: string, messages: LineMessage[]): Promise<void> {
  return send("reply", { replyToken, messages: messages.slice(0, 5) });
}

export function push(to: string, messages: LineMessage[]): Promise<void> {
  return send("push", { to, messages: messages.slice(0, 5) });
}

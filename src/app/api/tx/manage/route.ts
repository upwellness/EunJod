// POST /api/tx/manage — แก้ไข/ลบ รายการที่บันทึกแล้ว (token-gated)
// body: { token, action: "update"|"delete", txId, ...fields }
//   update fields: item, amount, type, cat, sub, note, date(yyyy-mm-dd, ส่งมาเฉพาะตอนเปลี่ยน)
import { ledgerByToken, getTxForLedger, updateTx, softDelete, learnKeyword } from "@/lib/db";
import { makeOccurredAt } from "@/lib/reports";
import type { TxRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const { token, action, txId } = body;
  if (!token || !action || !txId) return Response.json({ error: "missing fields" }, { status: 400 });

  const ledger = await ledgerByToken(token);
  if (!ledger) return Response.json({ error: "invalid or expired link" }, { status: 403 });

  const tx = await getTxForLedger(txId, ledger.id);
  if (!tx) return Response.json({ error: "transaction not found" }, { status: 404 });

  if (action === "delete") {
    await softDelete(tx.id);
    return Response.json({ ok: true });
  }

  if (action === "update") {
    const item = (body.item ?? "").trim() || tx.item;
    const amount = isFinite(Number(body.amount)) ? Number(body.amount) : Number(tx.amount);
    const type = body.type === "income" ? "income" : body.type === "expense" ? "expense" : tx.type;
    const cat = (body.cat ?? "").trim() || tx.cat || "อื่นๆ";
    const sub = body.sub && String(body.sub).trim() ? String(body.sub).trim() : null;
    const note = body.note !== undefined ? String(body.note).trim() || null : tx.note;

    const patch: Partial<TxRow> = { item, amount, type, cat, sub, note };

    if (body.date) {
      const [y, mo, d] = String(body.date).split("-").map(Number);
      if (y && mo && d) patch.occurred_at = makeOccurredAt(ledger.timezone, { kind: "absolute", y, m: mo, d });
    }

    await updateTx(tx.id, patch);
    // เปลี่ยนหมวด -> จำคำไว้ ครั้งหน้าจัดให้อัตโนมัติ
    if (cat !== tx.cat || sub !== tx.sub) {
      await learnKeyword(ledger.id, item, type, cat, sub, "user").catch(() => {});
    }
    return Response.json({ ok: true });
  }

  return Response.json({ error: "unknown action" }, { status: 400 });
}

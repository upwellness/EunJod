// POST /api/review/assign — จัดหมวดให้รายการจากหน้า Review (token-gated)
// body: { token, txId, category }  (category = "หมวดใหญ่" หรือ "หมวดใหญ่>ย่อย")
import { ledgerByToken, getTxForLedger, updateTx, learnKeyword } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { token?: string; txId?: string; category?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const { token, txId, category } = body;
  if (!token || !txId || !category) {
    return Response.json({ error: "missing fields" }, { status: 400 });
  }

  const ledger = await ledgerByToken(token);
  if (!ledger) return Response.json({ error: "invalid or expired link" }, { status: 403 });

  const tx = await getTxForLedger(txId, ledger.id);
  if (!tx) return Response.json({ error: "transaction not found" }, { status: 404 });

  const [catRaw, subRaw] = String(category).split(">");
  const cat = (catRaw || "อื่นๆ").trim();
  const sub = subRaw ? subRaw.trim() : null;

  await updateTx(tx.id, { cat, sub });
  // เรียนรู้: ครั้งหน้าพิมพ์คำนี้จะจัดหมวดให้อัตโนมัติ
  await learnKeyword(ledger.id, tx.item, tx.type, cat, sub, "user").catch(() => {});

  return Response.json({ ok: true, cat, sub });
}

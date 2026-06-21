// POST /api/categories/manage — จัดการหมวดต่อบัญชี (token-gated)
// body: { token, action, ...payload }
//   action: rename {oldName,newName} | add {type,cat,sub?} | hide {label} | unhide {label} | move {fromCat,toCat}
import { ledgerByToken, updateLedgerSettings, renameCatBulk, moveCatBulk } from "@/lib/db";
import { readConfig } from "@/lib/categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const { token, action } = body;
  if (!token || !action) return Response.json({ error: "missing token/action" }, { status: 400 });

  const ledger = await ledgerByToken(token);
  if (!ledger) return Response.json({ error: "invalid or expired link" }, { status: 403 });

  const config = readConfig(ledger.settings);

  if (action === "rename") {
    const oldName = (body.oldName || "").trim();
    const newName = (body.newName || "").trim();
    if (!oldName || !newName) return Response.json({ error: "missing names" }, { status: 400 });
    config.renames[oldName] = newName;
    await renameCatBulk(ledger.id, oldName, newName);
  } else if (action === "add") {
    const type = body.type === "income" ? "income" : "expense";
    const cat = (body.cat || "").trim();
    const sub = body.sub ? String(body.sub).trim() : null;
    if (!cat) return Response.json({ error: "missing cat" }, { status: 400 });
    if (!config.added.some((a) => a.type === type && a.cat === cat && a.sub === sub)) {
      config.added.push({ type, cat, sub });
    }
    const label = sub ? `${cat}>${sub}` : cat;
    config.hidden = config.hidden.filter((h) => h !== label); // เผื่อเคยซ่อนไว้
  } else if (action === "hide") {
    const label = (body.label || "").trim();
    if (!label) return Response.json({ error: "missing label" }, { status: 400 });
    if (!config.hidden.includes(label)) config.hidden.push(label);
  } else if (action === "unhide") {
    const label = (body.label || "").trim();
    config.hidden = config.hidden.filter((h) => h !== label);
  } else if (action === "move") {
    const fromCat = (body.fromCat || "").trim();
    const toCat = (body.toCat || "").trim();
    if (!fromCat || !toCat) return Response.json({ error: "missing cats" }, { status: 400 });
    await moveCatBulk(ledger.id, fromCat, toCat);
  } else {
    return Response.json({ error: "unknown action" }, { status: 400 });
  }

  const settings = { ...((ledger.settings as Record<string, unknown>) || {}), catConfig: config };
  await updateLedgerSettings(ledger.id, settings);
  return Response.json({ ok: true, config });
}

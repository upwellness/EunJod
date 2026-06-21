// ───────────────────────────────────────────────────────────────────────────
// commands.ts — สมองของบอท: รับข้อความ → ตัดสินใจ → คืนข้อความตอบกลับ
// คืน null = "เงียบ" (ไม่ตอบ) เช่น สมาชิกคุยเล่นในกลุ่มที่ตั้งบัญชีแล้ว
// ───────────────────────────────────────────────────────────────────────────
import { parseMessage, type TxType } from "./parser";
import { SEED } from "@/data/categories.seed";
import { buildDictionary, categorizeLocal, fallbackCat, normalize, catLabel, type CatRef } from "./categorize";
import { readConfig, effectiveGroups, summaryFromGroups, applyRename } from "./categories";
import { llmCategorize } from "./anthropic";
import { signed, formatTHB } from "./money";
import { text, DEFAULT_QUICK, type LineMessage } from "./line";
import { localRange, aggregate, formatSummary, makeOccurredAt, thaiDate, type RangeKind } from "./reports";
import * as repo from "./db";
import type { Ledger, TxRow } from "./types";

const DICT = buildDictionary(SEED);

export interface MsgInput {
  sourceId: string;
  sourceType: "group" | "room" | "user";
  text: string;
  userId?: string | null;
  messageId?: string | null;
}

const m = (s: string, quick?: { label: string; text: string }[]): LineMessage => text(s, quick);

// ── จัดหมวดแบบเต็ม (DB เรียนรู้ → พจนานุกรม → Claude → อื่นๆ) ───────────────────
async function resolveCategory(ledger: Ledger, item: string, type: TxType): Promise<CatRef & { source: string }> {
  const renames = readConfig(ledger.settings).renames;
  const ledgerId = ledger.id;
  let res: CatRef & { source: string };

  const learned = await repo.findLedgerKeyword(ledgerId, item, type);
  if (learned) {
    res = { type, cat: learned.cat, sub: learned.sub, emoji: learned.emoji || "🏷️", source: "user" };
  } else {
    const local = categorizeLocal(item, type, DICT);
    if (local) {
      res = { ...local, source: "dict" };
    } else {
      const llm = await llmCategorize(item, type);
      res = llm
        ? { type, cat: llm.cat, sub: llm.sub, emoji: "🏷️", source: "llm" }
        : { ...fallbackCat(type), source: "fallback" };
    }
  }

  res.cat = applyRename(res.cat, renames); // ใช้ชื่อหมวดที่ผู้ใช้เปลี่ยนไว้
  if (res.source === "llm") await repo.learnKeyword(ledgerId, item, type, res.cat, res.sub, "llm").catch(() => {});
  return res;
}

function parseCatPath(s: string): { cat: string; sub: string | null } {
  const [cat, sub] = s.split(/[>＞]/).map((x) => x.trim());
  return { cat: cat || "อื่นๆ", sub: sub || null };
}

// ── ตัวจัดการคำสั่ง ────────────────────────────────────────────────────────────
export async function handleText(input: MsgInput): Promise<LineMessage[] | null> {
  if (!repo.hasDb()) {
    return [m("⚠️ ระบบยังไม่ได้ตั้งค่าฐานข้อมูล (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)")];
  }

  const raw = input.text ?? "";
  const t = raw.trim();
  const lower = t.toLowerCase();
  if (!t) return null;

  // /help ใช้ได้ทุกที่ (ไม่ต้องมีบัญชีก่อน)
  if (lower === "/help" || lower === "help" || t === "ช่วยเหลือ") return [helpMessage()];

  // /setbook — ตั้งบัญชี (ทำได้แม้ยังไม่มีบัญชี)
  if (lower.startsWith("/setbook")) {
    const name = t.slice(t.indexOf("setbook") + "setbook".length).trim() || "บัญชีของฉัน";
    const led = await repo.setBook(input.sourceId, input.sourceType, name, input.userId ?? null);
    return [m(`📒 ตั้งบัญชีของกลุ่มนี้เป็น "${led.name}" แล้ว\n\nพิมพ์รายการได้เลย เช่น  กาแฟ 50  หรือ  +เงินเดือน 30000`, DEFAULT_QUICK)];
  }

  // หา ledger
  const ledger = await repo.getLedger(input.sourceId);
  if (!ledger) {
    const looksLikeEntry = parseMessage(t).length > 0;
    const looksLikeCommand = t.startsWith("/") || /^(ลบ|แก้|เดือนนี้|วันนี้|รายงาน|สรุป|งบ|หมวด|ค้นหา)/.test(t);
    if (looksLikeEntry || looksLikeCommand) {
      return [m('👋 กลุ่มนี้ยังไม่ได้ตั้งบัญชี\nพิมพ์  /setbook ชื่อบัญชี  เช่น  /setbook บ้านเรา')];
    }
    return null; // คุยเล่น ในกลุ่มที่ยังไม่ตั้งบัญชี → เงียบ
  }

  // ── คำสั่งดูข้อมูล/แก้ไข ──
  if (t === "ลบ" || lower === "undo" || t === "ยกเลิก") return [await handleDelete(ledger)];
  if (t.startsWith("แก้หมวด")) return [await handleEditCategory(ledger, t.slice("แก้หมวด".length).trim())];
  if (t.startsWith("แก้")) return [await handleEditAmount(ledger, t.slice("แก้".length).trim())];

  if (t === "เดือนนี้") return [await report(ledger, "month")];
  if (t === "เดือนที่แล้ว") return [await report(ledger, "lastmonth")];
  if (t === "วันนี้") return [await report(ledger, "today")];
  if (t === "เมื่อวาน") return [await report(ledger, "yesterday")];
  if (t === "สรุป") return [await report(ledger, "month")];
  if (t === "รายงาน") return [await report(ledger, "month", true)];
  if (lower === "/review" || t === "รีวิว" || t === "จัดหมวด" || t === "ตรวจหมวด") return [await handleReview(ledger)];
  if (lower === "/cats" || lower === "/categories" || t === "หมวด" || t === "หมวดหมู่" || t === "หมวดทั้งหมด" || t === "ดูหมวด")
    return [m(summaryFromGroups(effectiveGroups(SEED, readConfig(ledger.settings))), DEFAULT_QUICK)];
  if (lower === "/editcat" || lower === "/managecat" || t === "จัดการหมวด" || t === "แก้ชื่อหมวด")
    return [await handleEditCat(ledger)];

  if (lower === "/book" || t === "บัญชี") return [await handleBook(ledger)];
  if (t === "งบ" || lower === "/budget" || lower === "budget") {
    if (lower.startsWith("/budget") || lower === "budget") return [await handleSetBudget(ledger, t)];
    return [await handleBudgetStatus(ledger)];
  }
  if (lower.startsWith("/budget")) return [await handleSetBudget(ledger, t)];
  if (lower.startsWith("/cat")) return [await handleTeach(ledger, t.slice(t.toLowerCase().indexOf("/cat") + 4).trim())];
  if (lower.startsWith("/export")) return [await report(ledger, "month", true)];
  if (t.startsWith("หมวด ")) return [await handleCategoryDetail(ledger, t.slice("หมวด".length).trim())];
  if (t.startsWith("ค้นหา")) return [await handleSearch(ledger, t.slice("ค้นหา".length).trim())];

  // ── ไม่ใช่คำสั่ง → ลองจดรายการ ──
  return await handleRecord(ledger, input);
}

// ── จดรายการ ──────────────────────────────────────────────────────────────────
async function handleRecord(ledger: Ledger, input: MsgInput): Promise<LineMessage[] | null> {
  const entries = parseMessage(input.text);
  if (entries.length === 0) return null; // ไม่มีตัวเลขเงิน → เงียบ

  const recorded: { item: string; type: TxType; amount: number; ref: CatRef & { source: string }; occurredAt?: string }[] = [];
  for (const e of entries) {
    const ref = await resolveCategory(ledger, e.item, e.type);
    const occurredAt = e.date ? makeOccurredAt(ledger.timezone, e.date) : undefined;
    const row: Partial<TxRow> = {
      ledger_id: ledger.id,
      user_id: input.userId ?? null,
      type: e.type,
      amount: e.amount,
      item: e.item,
      cat: ref.cat,
      sub: ref.sub,
      note: e.note ?? null,
      source_message_id: input.messageId ?? null,
      raw_text: e.raw,
    };
    if (occurredAt) row.occurred_at = occurredAt;
    await repo.insertTx(row);
    recorded.push({ item: e.item, type: e.type, amount: e.amount, ref, occurredAt });
  }

  const dateTag = (o?: string) => (o ? ` 📅 ${thaiDate(ledger.timezone, o)}` : "");

  if (recorded.length === 1) {
    const r = recorded[0];
    let body = `✅ จด: ${r.item} ${signed(r.type, r.amount)} บาท${dateTag(r.occurredAt)}\n${r.ref.emoji} ${catLabel(r.ref)}`;
    if (r.ref.source === "fallback") body += `\n\n❓ ยังไม่รู้หมวด — สอนได้: แก้หมวด กิน > เครื่องดื่ม`;
    const budgetLine = r.type === "expense" ? await budgetHint(ledger, r.ref.cat) : "";
    if (budgetLine) body += `\n${budgetLine}`;
    return [m(body, DEFAULT_QUICK)];
  }

  // หลายรายการ
  const lines = recorded.map((r) => `• ${r.item} ${signed(r.type, r.amount)} (${catLabel(r.ref)})${dateTag(r.occurredAt)}`);
  const inc = recorded.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
  const exp = recorded.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
  const summary = `✅ จด ${recorded.length} รายการ\n${lines.join("\n")}\n\nรวมจ่าย −${formatTHB(exp)}${inc ? ` · รวมรับ +${formatTHB(inc)}` : ""}`;
  return [m(summary, DEFAULT_QUICK)];
}

async function budgetHint(ledger: Ledger, cat: string): Promise<string> {
  const budgets = await repo.getBudgets(ledger.id);
  const b = budgets.find((x) => x.cat === cat);
  if (!b) return "";
  const { start, end } = localRange(ledger.timezone, "month");
  const txs = await repo.txInRange(ledger.id, start.toISOString(), end.toISOString());
  const spent = txs.filter((x) => x.type === "expense" && x.cat === cat).reduce((s, x) => s + Number(x.amount), 0);
  const left = Number(b.amount) - spent;
  const pct = Math.round((spent / Number(b.amount)) * 100);
  const icon = pct >= 100 ? "🚨 เกินงบ" : pct >= 80 ? "⚠️ ใกล้เต็มงบ" : "💰";
  return `${icon} ${cat}: ใช้ ${formatTHB(spent)}/${formatTHB(Number(b.amount))} (${pct}%) ${left >= 0 ? `เหลือ ${formatTHB(left)}` : `เกิน ${formatTHB(-left)}`}`;
}

// ── ลบ / แก้ ──────────────────────────────────────────────────────────────────
async function handleDelete(ledger: Ledger): Promise<LineMessage> {
  const last = await repo.lastTx(ledger.id);
  if (!last) return m("ไม่มีรายการให้ลบ");
  await repo.softDelete(last.id);
  return m(`🗑️ ลบแล้ว: ${last.item} ${signed(last.type, Number(last.amount))} บาท`);
}

async function handleEditAmount(ledger: Ledger, rest: string): Promise<LineMessage> {
  const num = parseFloat(rest.replace(/[, ]/g, ""));
  if (!isFinite(num)) return m("พิมพ์  แก้ <จำนวน>  เช่น  แก้ 70");
  const last = await repo.lastTx(ledger.id);
  if (!last) return m("ไม่มีรายการให้แก้");
  await repo.updateTx(last.id, { amount: num });
  return m(`✏️ แก้ยอด: ${last.item} → ${signed(last.type, num)} บาท`);
}

async function handleEditCategory(ledger: Ledger, rest: string): Promise<LineMessage> {
  if (!rest) return m("พิมพ์  แก้หมวด <หมวด> [> ย่อย]  เช่น  แก้หมวด เดินทาง > ทางด่วน");
  const { cat, sub } = parseCatPath(rest);
  const last = await repo.lastTx(ledger.id);
  if (!last) return m("ไม่มีรายการให้แก้หมวด");
  await repo.updateTx(last.id, { cat, sub });
  await repo.learnKeyword(ledger.id, last.item, last.type, cat, sub, "user").catch(() => {});
  return m(`🏷️ แก้หมวด "${last.item}" → ${sub ? `${cat} > ${sub}` : cat}\n(จำไว้แล้ว ครั้งหน้าจะจัดให้อัตโนมัติ)`);
}

// ── สอนหมวด / งบ / บัญชี ────────────────────────────────────────────────────────
async function handleTeach(ledger: Ledger, rest: string): Promise<LineMessage> {
  const [word, path] = rest.split(/[=:]/).map((x) => x.trim());
  if (!word || !path) return m("พิมพ์  /cat <คำ> = <หมวด> [> ย่อย]  เช่น  /cat ชานม = กิน > เครื่องดื่ม");
  const { cat, sub } = parseCatPath(path);
  await repo.learnKeyword(ledger.id, word, "expense", cat, sub, "user");
  return m(`📚 จำแล้ว: "${word}" = ${sub ? `${cat} > ${sub}` : cat}`);
}

async function handleSetBudget(ledger: Ledger, t: string): Promise<LineMessage> {
  const rest = t.replace(/^\/budget/i, "").trim();
  const parts = rest.split(/\s+/);
  const amount = parseFloat((parts.pop() || "").replace(/[, ]/g, ""));
  let cat = parts.join(" ").trim();
  if (!cat || !isFinite(amount)) {
    const cats = summaryFromGroups(effectiveGroups(SEED, readConfig(ledger.settings)));
    return m("พิมพ์  /budget <หมวด> <จำนวน>  เช่น  /budget กิน 5000\n\n" + cats);
  }
  cat = applyRename(cat, readConfig(ledger.settings).renames);
  await repo.setBudget(ledger.id, cat, amount);
  return m(`💰 ตั้งงบ "${cat}" = ${formatTHB(amount)} บาท/เดือน แล้ว`);
}

async function handleEditCat(ledger: Ledger): Promise<LineMessage> {
  let link = "";
  try {
    const token = await repo.createReportToken(ledger.id);
    const base = process.env.APP_BASE_URL || "";
    if (base) link = `${base}/categories/${token}`;
  } catch {
    /* ไม่มีลิงก์ก็แจ้งได้ */
  }
  return m(
    link
      ? `🗂️ จัดการหมวด (เปลี่ยนชื่อ · เพิ่ม · ซ่อน · ย้าย) — กดลิงก์:\n${link}`
      : "🗂️ จัดการหมวดผ่านหน้าเว็บ — ระบบยังสร้างลิงก์ไม่ได้ตอนนี้",
    DEFAULT_QUICK,
  );
}

async function handleBudgetStatus(ledger: Ledger): Promise<LineMessage> {
  const budgets = await repo.getBudgets(ledger.id);
  if (!budgets.length) return m("ยังไม่ได้ตั้งงบ — พิมพ์  /budget กิน 5000");
  const { start, end } = localRange(ledger.timezone, "month");
  const txs = await repo.txInRange(ledger.id, start.toISOString(), end.toISOString());
  const lines = budgets.map((b) => {
    const spent = txs.filter((x) => x.type === "expense" && x.cat === (b.cat ?? "")).reduce((s, x) => s + Number(x.amount), 0);
    const pct = Math.round((spent / Number(b.amount)) * 100);
    const bar = "█".repeat(Math.min(10, Math.round(pct / 10))).padEnd(10, "░");
    return `${b.cat}\n${bar} ${pct}%  (${formatTHB(spent)}/${formatTHB(Number(b.amount))})`;
  });
  return m(`💰 งบเดือนนี้ · "${ledger.name}"\n\n${lines.join("\n\n")}`);
}

async function handleBook(ledger: Ledger): Promise<LineMessage> {
  const { start, end } = localRange(ledger.timezone, "month");
  const txs = await repo.txInRange(ledger.id, start.toISOString(), end.toISOString());
  return m(`📒 บัญชี: "${ledger.name}"\nสกุลเงิน: ${ledger.currency} · เขต: ${ledger.timezone}\nรายการเดือนนี้: ${txs.length}`);
}

// ── รายงาน / หมวด / ค้นหา ───────────────────────────────────────────────────────
async function report(ledger: Ledger, kind: RangeKind, withLink = false): Promise<LineMessage> {
  const r = localRange(ledger.timezone, kind);
  const txs = await repo.txInRange(ledger.id, r.start.toISOString(), r.end.toISOString());
  const s = aggregate(txs);
  let link: string | undefined;
  if (withLink) {
    try {
      const token = await repo.createReportToken(ledger.id);
      const base = process.env.APP_BASE_URL || "";
      link = base ? `${base}/r/${token}` : undefined;
    } catch { /* ไม่มีลิงก์ก็ไม่เป็นไร */ }
  }
  return m(formatSummary(r.label, ledger.name, s, link), DEFAULT_QUICK);
}

async function handleReview(ledger: Ledger): Promise<LineMessage> {
  const txs = await repo.uncategorizedTx(ledger.id);
  if (!txs.length) return m("เยี่ยม! ไม่มีรายการที่ยังไม่รู้หมวด 🎉");
  let link = "";
  try {
    const token = await repo.createReportToken(ledger.id);
    const base = process.env.APP_BASE_URL || "";
    if (base) link = `${base}/review/${token}`;
  } catch {
    /* ไม่มีลิงก์ก็ยังบอกจำนวนได้ */
  }
  const head = `📋 มี ${txs.length} รายการที่ยังไม่รู้หมวด (ตอนนี้อยู่ในหมวด "อื่นๆ")`;
  return m(
    link ? `${head}\n\nกดลิงก์มาจัดหมวด — เลือกแล้วบอทจะจำให้ ครั้งหน้าจัดอัตโนมัติ:\n${link}` : head,
    DEFAULT_QUICK,
  );
}

async function handleCategoryDetail(ledger: Ledger, name: string): Promise<LineMessage> {
  if (!name) return m("พิมพ์  หมวด <ชื่อหมวด>  เช่น  หมวด กิน");
  const { start, end } = localRange(ledger.timezone, "month");
  const txs = (await repo.txInRange(ledger.id, start.toISOString(), end.toISOString()))
    .filter((x) => x.type === "expense" && (x.cat === name || x.sub === name));
  if (!txs.length) return m(`เดือนนี้ยังไม่มีรายการหมวด "${name}"`);
  const total = txs.reduce((s, x) => s + Number(x.amount), 0);
  const lines = txs.slice(-15).map((x) => `• ${x.item} −${formatTHB(Number(x.amount))}`);
  return m(`📂 หมวด "${name}" (เดือนนี้) รวม −${formatTHB(total)} · ${txs.length} รายการ\n${lines.join("\n")}`);
}

async function handleSearch(ledger: Ledger, term: string): Promise<LineMessage> {
  if (!term) return m("พิมพ์  ค้นหา <คำ>  เช่น  ค้นหา กาแฟ");
  const txs = await repo.searchTx(ledger.id, term);
  if (!txs.length) return m(`ไม่พบรายการที่มีคำว่า "${term}"`);
  const lines = txs.map((x) => `• ${x.item} ${signed(x.type, Number(x.amount))} (${x.cat ?? "-"})`);
  return m(`🔎 ผลค้นหา "${term}" (${txs.length})\n${lines.join("\n")}`);
}

function helpMessage(): LineMessage {
  return m(
    [
      "🧾 EunJod (น้องจด) — คู่มือใช้งาน",
      "",
      "📝 จด: พิมพ์  รายการ จำนวน",
      "   เช่น  กาแฟ 50  ·  +เงินเดือน 30000",
      "   หลายรายการ: ข้าว 60, ทางด่วน 80",
      "",
      "✏️ แก้: ลบ · แก้ 70 · แก้หมวด เดินทาง",
      "📊 ดู: วันนี้ · เดือนนี้ · รายงาน · งบ",
      "   หมวด กิน · ค้นหา กาแฟ · /cats (ดูหมวดทั้งหมด)",
      "🏷️ /review — จัดหมวดรายการที่ยังไม่รู้ (อื่นๆ)",
      "🗂️ /editcat — จัดการหมวด (เปลี่ยนชื่อ/เพิ่ม/ซ่อน/ย้าย)",
      "",
      "⚙️ ตั้งค่า:",
      "   /setbook ชื่อบัญชี",
      "   /budget กิน 5000",
      "   /cat ชานม = กิน > เครื่องดื่ม",
      "   /export",
    ].join("\n"),
    DEFAULT_QUICK,
  );
}

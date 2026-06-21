// db.ts — Supabase admin client + repository functions (เข้าถึงข้อมูลทั้งหมด)
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalize } from "./categorize";
import type { TxType } from "./parser";
import type { Ledger, TxRow, KeywordRow, BudgetRow } from "./types";

let _client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("ยังไม่ได้ตั้ง SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ใน .env.local");
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

export function hasDb(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// ── Ledger ──────────────────────────────────────────────────────────────────
export async function getLedger(sourceId: string): Promise<Ledger | null> {
  const { data } = await db().from("ledgers").select("*").eq("source_id", sourceId).maybeSingle();
  return (data as Ledger) ?? null;
}

export async function setBook(
  sourceId: string,
  sourceType: string,
  name: string,
  ownerUserId: string | null,
): Promise<Ledger> {
  const existing = await getLedger(sourceId);
  if (existing) {
    const { data, error } = await db().from("ledgers").update({ name }).eq("id", existing.id).select().single();
    if (error) throw error;
    return data as Ledger;
  }
  const { data, error } = await db()
    .from("ledgers")
    .insert({ source_id: sourceId, source_type: sourceType, name, owner_user_id: ownerUserId })
    .select()
    .single();
  if (error) throw error;
  return data as Ledger;
}

// ── Transactions ─────────────────────────────────────────────────────────────
export async function insertTx(row: Partial<TxRow>): Promise<TxRow> {
  const { data, error } = await db().from("transactions").insert(row).select().single();
  if (error) throw error;
  return data as TxRow;
}

export async function lastTx(ledgerId: string): Promise<TxRow | null> {
  const { data } = await db()
    .from("transactions")
    .select("*")
    .eq("ledger_id", ledgerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as TxRow) ?? null;
}

export async function softDelete(id: string): Promise<void> {
  await db().from("transactions").update({ deleted_at: new Date().toISOString() }).eq("id", id);
}

export async function updateTx(id: string, patch: Partial<TxRow>): Promise<void> {
  await db().from("transactions").update(patch).eq("id", id);
}

export async function txInRange(ledgerId: string, startISO: string, endISO: string): Promise<TxRow[]> {
  const { data } = await db()
    .from("transactions")
    .select("*")
    .eq("ledger_id", ledgerId)
    .is("deleted_at", null)
    .gte("occurred_at", startISO)
    .lt("occurred_at", endISO)
    .order("occurred_at", { ascending: true });
  return (data as TxRow[]) ?? [];
}

export async function searchTx(ledgerId: string, term: string, limit = 15): Promise<TxRow[]> {
  const { data } = await db()
    .from("transactions")
    .select("*")
    .eq("ledger_id", ledgerId)
    .is("deleted_at", null)
    .ilike("item", `%${term}%`)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  return (data as TxRow[]) ?? [];
}

/** รายการที่ยังไม่รู้หมวด (cat = "อื่นๆ" หรือว่าง) สำหรับหน้า Review */
export async function uncategorizedTx(ledgerId: string, limit = 100): Promise<TxRow[]> {
  const { data } = await db()
    .from("transactions")
    .select("*")
    .eq("ledger_id", ledgerId)
    .is("deleted_at", null)
    .or("cat.eq.อื่นๆ,cat.is.null")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as TxRow[]) ?? [];
}

/** ดึงรายการเฉพาะที่เป็นของ ledger นี้ (กันแก้ข้ามบัญชี) */
export async function getTxForLedger(id: string, ledgerId: string): Promise<TxRow | null> {
  const { data } = await db()
    .from("transactions")
    .select("*")
    .eq("id", id)
    .eq("ledger_id", ledgerId)
    .maybeSingle();
  return (data as TxRow) ?? null;
}

// ── Keywords (เรียนรู้ต่อกลุ่ม) ────────────────────────────────────────────────
export async function findLedgerKeyword(
  ledgerId: string,
  keyword: string,
  type: TxType,
): Promise<KeywordRow | null> {
  const { data } = await db()
    .from("keywords")
    .select("*")
    .eq("ledger_id", ledgerId)
    .eq("keyword", normalize(keyword))
    .eq("type", type)
    .order("hits", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as KeywordRow) ?? null;
}

export async function learnKeyword(
  ledgerId: string,
  keyword: string,
  type: TxType,
  cat: string,
  sub: string | null,
  source: string,
): Promise<void> {
  const kw = normalize(keyword);
  if (!kw) return;
  // ลบของเดิม (ledger+keyword+type) แล้วใส่ใหม่ ให้คำสอนล่าสุดมีผล
  await db().from("keywords").delete().eq("ledger_id", ledgerId).eq("keyword", kw).eq("type", type);
  await db().from("keywords").insert({ ledger_id: ledgerId, keyword: kw, type, cat, sub, source });
}

// ── Budgets ──────────────────────────────────────────────────────────────────
export async function setBudget(ledgerId: string, cat: string | null, amount: number): Promise<void> {
  await db().from("budgets").delete().eq("ledger_id", ledgerId).eq("period", "month").eq("cat", cat ?? "");
  await db().from("budgets").insert({ ledger_id: ledgerId, cat, period: "month", amount });
}

export async function getBudgets(ledgerId: string): Promise<BudgetRow[]> {
  const { data } = await db().from("budgets").select("*").eq("ledger_id", ledgerId).eq("period", "month");
  return (data as BudgetRow[]) ?? [];
}

// ── Report token (ลิงก์เว็บ) ────────────────────────────────────────────────────
export async function createReportToken(ledgerId: string): Promise<string> {
  const token = (globalThis.crypto?.randomUUID?.() ?? `${ledgerId}-${Math.round(performance.now())}`).replace(/-/g, "");
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  await db().from("report_tokens").insert({ ledger_id: ledgerId, token, expires_at: expires });
  return token;
}

export async function ledgerByToken(token: string): Promise<Ledger | null> {
  const { data } = await db()
    .from("report_tokens")
    .select("ledger_id, expires_at, ledgers(*)")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as { expires_at: string | null; ledgers: Ledger };
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null;
  return row.ledgers ?? null;
}

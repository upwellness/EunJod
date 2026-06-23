// reports.ts — ช่วงเวลา (ตาม timezone) + สรุปยอด + จัดรูปแบบข้อความ
import type { TxRow } from "./types";
import type { DateHint } from "./parser";
import { formatTHB } from "./money";

export type RangeKind = "today" | "yesterday" | "month" | "lastmonth";

function parts(tz: string, date: Date): Record<string, string> {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(date)) if (p.type !== "literal") o[p.type] = p.value;
  return o;
}

/** ระยะห่าง wall-clock ของ tz จาก UTC (ms) — Asia/Bangkok = +7 ชม. */
function offsetMs(tz: string, date: Date): number {
  const p = parts(tz, date);
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUTC - date.getTime()) / 60000) * 60000;
}

export interface Range { start: Date; end: Date; label: string }

export function localRange(tz: string, kind: RangeKind): Range {
  const now = new Date();
  const off = offsetMs(tz, now);
  const p = parts(tz, now);
  const y = +p.year, m = +p.month, d = +p.day;
  const mk = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm - 1, dd, 0, 0, 0) - off);
  switch (kind) {
    case "today": return { start: mk(y, m, d), end: mk(y, m, d + 1), label: "วันนี้" };
    case "yesterday": return { start: mk(y, m, d - 1), end: mk(y, m, d), label: "เมื่อวาน" };
    case "month": return { start: mk(y, m, 1), end: mk(y, m + 1, 1), label: `เดือนนี้ (${m}/${y})` };
    case "lastmonth": return { start: mk(y, m - 1, 1), end: mk(y, m, 1), label: `เดือนที่แล้ว (${m - 1 || 12}/${m - 1 ? y : y - 1})` };
  }
}

function normYear(y: number): number {
  if (y < 100) y += 2500; // 68 -> 2568 (พ.ศ. ย่อ)
  if (y >= 2500) y -= 543; // พ.ศ. -> ค.ศ.
  return y;
}

/** แปลงคำใบ้วันที่ -> occurred_at (ISO) ตาม timezone (คงเวลาปัจจุบันของวันไว้เพื่อลำดับที่ถูก) */
export function makeOccurredAt(tz: string, hint: DateHint): string {
  const now = new Date();
  const off = offsetMs(tz, now);
  const p = parts(tz, now);
  const hh = +p.hour, mi = +p.minute;
  let y = +p.year, mo = +p.month, d = +p.day;
  if (hint.kind === "relative") {
    d = d + hint.days;
  } else {
    d = hint.d;
    mo = hint.m;
    y = hint.y == null ? y : normYear(hint.y);
  }
  return new Date(Date.UTC(y, mo - 1, d, hh, mi, 0) - off).toISOString();
}

/** วันที่แบบไทยสั้น เช่น "12 มิ.ย." */
export function thaiDate(tz: string, iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", { timeZone: tz, day: "numeric", month: "short" });
}

export interface Summary {
  income: number;
  expense: number;
  net: number;
  byCat: [string, number][];
  count: number;
}

export function aggregate(txs: TxRow[]): Summary {
  let income = 0, expense = 0;
  const byCat = new Map<string, number>();
  for (const t of txs) {
    const amt = Number(t.amount);
    if (t.type === "income") {
      income += amt;
    } else {
      expense += amt;
      const key = t.sub ? `${t.cat} > ${t.sub}` : t.cat || "อื่นๆ";
      byCat.set(key, (byCat.get(key) || 0) + amt);
    }
  }
  return {
    income, expense, net: income - expense, count: txs.length,
    byCat: [...byCat.entries()].sort((a, b) => b[1] - a[1]),
  };
}

/** สรุปสิ้นวันแบบลงรายการ: เรียงแยกหมวด + ลิสต์ทุกรายการใต้หมวด + ยอดย่อย/รวม */
export function formatDailyDetail(label: string, ledgerName: string, txs: TxRow[]): string {
  const lines: string[] = [`📅 ${label} · บัญชี "${ledgerName}"`];
  if (txs.length === 0) {
    lines.push("", "ยังไม่มีรายการ");
    return lines.join("\n");
  }

  const section = (type: "income" | "expense", header: string, sign: string) => {
    const groups = new Map<string, TxRow[]>();
    for (const t of txs) {
      if (t.type !== type) continue;
      const key = t.sub ? `${t.cat} > ${t.sub}` : t.cat || "อื่นๆ";
      const arr = groups.get(key) ?? [];
      arr.push(t);
      groups.set(key, arr);
    }
    if (groups.size === 0) return;
    lines.push("", header);
    const entries = [...groups.entries()]
      .map(([k, arr]) => ({ k, arr, sum: arr.reduce((s, t) => s + Number(t.amount), 0) }))
      .sort((a, b) => b.sum - a.sum);
    for (const g of entries) {
      lines.push(`▸ ${g.k} (${sign}${formatTHB(g.sum)})`);
      for (const t of g.arr) {
        lines.push(`   • ${t.item} ${sign}${formatTHB(Number(t.amount))}${t.note ? ` #${t.note}` : ""}`);
      }
    }
  };

  section("expense", "💸 รายจ่าย", "−");
  section("income", "💵 รายรับ", "+");

  const exp = txs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const inc = txs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const net = inc - exp;
  lines.push("", "──────────");
  lines.push(`รวมจ่าย −${formatTHB(exp)}${inc ? ` · รวมรับ +${formatTHB(inc)}` : ""}`);
  lines.push(`คงเหลือ ${net >= 0 ? "+" : "−"}${formatTHB(Math.abs(net))} · ${txs.length} รายการ`);
  return lines.join("\n");
}

export function formatSummary(label: string, ledgerName: string, s: Summary, extraLink?: string): string {
  const lines: string[] = [];
  lines.push(`📊 ${label} · บัญชี "${ledgerName}"`);
  lines.push("");
  lines.push(`💵 รายรับ   +${formatTHB(s.income)}`);
  lines.push(`💸 รายจ่าย  −${formatTHB(s.expense)}`);
  lines.push(`${s.net >= 0 ? "✅" : "⚠️"} คงเหลือ  ${s.net >= 0 ? "+" : "−"}${formatTHB(Math.abs(s.net))}`);
  if (s.byCat.length) {
    lines.push("");
    lines.push("— รายจ่ายแยกหมวด —");
    const total = s.expense || 1;
    s.byCat.slice(0, 8).forEach(([k, v], i) => {
      const pct = Math.round((v / total) * 100);
      lines.push(`${i + 1}. ${k}  −${formatTHB(v)} (${pct}%)`);
    });
  }
  if (s.count === 0) lines.push("\n(ยังไม่มีรายการในช่วงนี้)");
  if (extraLink) lines.push(`\n📈 ดูกราฟ: ${extraLink}`);
  return lines.join("\n");
}

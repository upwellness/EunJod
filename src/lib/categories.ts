// ───────────────────────────────────────────────────────────────────────────
// categories.ts — การปรับแต่งหมวด "ต่อบัญชี" (rename / add / hide) เก็บใน ledgers.settings.catConfig
// pure logic (เทสต์ได้) — ส่วนเขียน DB อยู่ใน db.ts, UI อยู่ใน /categories/[token]
// ───────────────────────────────────────────────────────────────────────────
import type { SeedEntry, TxType } from "@/data/categories.seed";
import type { CatGroup } from "./categorize";

export interface CatConfig {
  renames: Record<string, string>; // ชื่อเดิม/ปัจจุบัน -> ชื่อใหม่ (ใช้แบบต่อทอด)
  added: { type: TxType; cat: string; sub: string | null }[]; // หมวดที่เพิ่มเอง
  hidden: string[]; // ป้ายหมวดที่ซ่อน ("หมวด" หรือ "หมวด>ย่อย")
}

export const EMPTY_CONFIG: CatConfig = { renames: {}, added: [], hidden: [] };

/** อ่าน config จาก ledgers.settings (กันค่าเพี้ยน) */
export function readConfig(settings: unknown): CatConfig {
  const s = (settings ?? {}) as Record<string, unknown>;
  const c = (s.catConfig ?? {}) as Record<string, unknown>;
  return {
    renames: (c.renames as Record<string, string>) ?? {},
    added: Array.isArray(c.added) ? (c.added as CatConfig["added"]) : [],
    hidden: Array.isArray(c.hidden) ? (c.hidden as string[]) : [],
  };
}

/** ตามชื่อหมวดผ่านแผนที่ rename แบบต่อทอด (กันวน) */
export function applyRename(name: string, renames: Record<string, string>): string {
  let n = name;
  const seen = new Set<string>();
  while (renames[n] && !seen.has(n)) {
    seen.add(n);
    n = renames[n];
  }
  return n;
}

/** หมวดที่ใช้ได้จริงของบัญชีนี้ = SEED (ผ่าน rename) + หมวดที่เพิ่มเอง − หมวดที่ซ่อน */
export function effectiveGroups(seed: SeedEntry[], config: CatConfig): CatGroup[] {
  const map = new Map<string, CatGroup>();
  const put = (type: TxType, cat: string, sub: string | null, emoji: string) => {
    const rc = applyRename(cat, config.renames);
    const key = `${type}:${rc}`;
    const g = map.get(key) ?? { type, cat: rc, emoji, subs: [] };
    if (sub) {
      const rs = applyRename(`${rc}>${sub}`, config.renames).split(">").pop() || sub;
      if (!g.subs.includes(rs)) g.subs.push(rs);
    }
    map.set(key, g);
  };
  for (const e of seed) put(e.type, e.cat, e.sub, e.emoji);
  for (const a of config.added) put(a.type, a.cat, a.sub, "🏷️");

  const hidden = new Set(config.hidden);
  const out: CatGroup[] = [];
  for (const g of map.values()) {
    if (hidden.has(g.cat)) continue;
    g.subs = g.subs.filter((s) => !hidden.has(`${g.cat}>${s}`));
    out.push(g);
  }
  return out;
}

/** ข้อความสรุปหมวด (สำหรับ /cats) จากกลุ่มที่ปรับแต่งแล้ว */
export function summaryFromGroups(groups: CatGroup[]): string {
  const lines: string[] = ['📂 หมวดทั้งหมด (ตั้งงบใช้ชื่อ "หมวดใหญ่")', "", "— รายจ่าย —"];
  for (const g of groups.filter((x) => x.type === "expense")) {
    lines.push(`${g.emoji} ${g.cat}${g.subs.length ? `\n   └ ${g.subs.join(" · ")}` : ""}`);
  }
  const inc = groups.filter((x) => x.type === "income").map((g) => `${g.emoji} ${g.cat}`);
  lines.push("", "— รายรับ —", inc.join(" · "));
  lines.push("", "💡 ตั้งงบ: /budget กิน 5000 · จัดการหมวด: /editcat");
  return lines.join("\n");
}

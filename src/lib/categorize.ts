// ───────────────────────────────────────────────────────────────────────────
// categorize.ts — เครื่องจัดหมวด (ส่วน pure ที่เทสต์ได้)
// ชั้นที่ใช้ที่นี่: พจนานุกรมกลาง (exact หลาย variant → forward contains)
// ชั้น DB (คำที่กลุ่มสอน) + ชั้น Claude อยู่ฝั่ง server (commands.ts) เพราะต้องต่อภายนอก
// ───────────────────────────────────────────────────────────────────────────

import type { SeedEntry, TxType } from "@/data/categories.seed";

export interface CatRef {
  type: TxType;
  cat: string;
  sub: string | null;
  emoji: string;
}

export interface Dictionary {
  exact: Map<string, CatRef>;
  entries: { kw: string; ref: CatRef }[];
}

/** ปรับคำให้เทียบกันง่าย: ตัวพิมพ์เล็ก + ตัดช่องว่าง (ไม่ตัด "ค่า" ที่นี่ — ทำตอน match เป็น variant) */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "").trim();
}

/** สร้าง variant สำหรับ match: คำเต็ม, ตัด "ค่า" นำหน้า, ตัดกริยา ซื้อ/จ่าย/เติม นำหน้า */
function variantsOf(n: string): string[] {
  const out = [n];
  if (n.startsWith("ค่า") && n.length > 3) out.push(n.slice(2));
  const noVerb = n.replace(/^(จ่ายค่า|จ่าย|ซื้อ|เติม)/, "");
  if (noVerb !== n && noVerb.length >= 2) out.push(noVerb);
  return out;
}

export function buildDictionary(seed: SeedEntry[]): Dictionary {
  const exact = new Map<string, CatRef>();
  const entries: { kw: string; ref: CatRef }[] = [];
  for (const e of seed) {
    const ref: CatRef = { type: e.type, cat: e.cat, sub: e.sub, emoji: e.emoji };
    for (const kw of e.keywords) {
      const n = normalize(kw);
      if (!n) continue;
      if (!exact.has(n)) exact.set(n, ref);
      entries.push({ kw: n, ref });
    }
  }
  // เรียงคำยาว→สั้น เพื่อให้ contains จับคำเฉพาะเจาะจงก่อน
  entries.sort((a, b) => b.kw.length - a.kw.length);
  return { exact, entries };
}

/** จัดหมวดจากพจนานุกรมกลาง — คืน null ถ้าไม่เจอ (ให้ผู้เรียกไปถาม AI / ตกหมวดอื่นๆ ต่อ) */
export function categorizeLocal(item: string, type: TxType, dict: Dictionary): CatRef | null {
  const n = normalize(item);
  if (!n) return null;
  const variants = variantsOf(n);

  // 1) exact ตาม variant (คำเต็มก่อน แล้วค่อยแบบตัด "ค่า")
  for (const v of variants) {
    const ex = dict.exact.get(v);
    if (ex && ex.type === type) return ex;
  }

  // 2) forward contains — คีย์เวิร์ดเป็นส่วนหนึ่งของสิ่งที่พิมพ์ (เช่น "กาแฟเย็น" -> "กาแฟ")
  for (const { kw, ref } of dict.entries) {
    if (ref.type !== type) continue;
    if (kw.length >= 2 && variants.some((v) => v.includes(kw))) return ref;
  }
  return null;
}

/** หมวดสำรองเมื่อไม่รู้จริง */
export function fallbackCat(type: TxType): CatRef {
  return { type, cat: "อื่นๆ", sub: null, emoji: type === "income" ? "💰" : "❓" };
}

/** ป้ายหมวดอ่านง่าย เช่น "กิน > เครื่องดื่ม" */
export function catLabel(ref: { cat: string; sub: string | null }): string {
  return ref.sub ? `${ref.cat} > ${ref.sub}` : ref.cat;
}

/** ข้อความสรุป "หมวดทั้งหมด" สำหรับ /cats และตอนช่วยตั้งงบ */
export function categoriesSummary(seed: SeedEntry[]): string {
  const group = (type: TxType) => {
    const byCat = new Map<string, { emoji: string; subs: string[] }>();
    for (const e of seed) {
      if (e.type !== type) continue;
      const g = byCat.get(e.cat) ?? { emoji: e.emoji, subs: [] };
      if (e.sub) g.subs.push(e.sub);
      byCat.set(e.cat, g);
    }
    return byCat;
  };

  const lines: string[] = ['📂 หมวดทั้งหมด (ตั้งงบใช้ชื่อ "หมวดใหญ่")', "", "— รายจ่าย —"];
  for (const [cat, g] of group("expense")) {
    lines.push(`${g.emoji} ${cat}${g.subs.length ? `\n   └ ${g.subs.join(" · ")}` : ""}`);
  }
  const inc: string[] = [];
  for (const [cat, g] of group("income")) inc.push(`${g.emoji} ${cat}`);
  lines.push("", "— รายรับ —", inc.join(" · "));
  lines.push("", "💡 ตั้งงบ: /budget กิน 5000");
  return lines.join("\n");
}

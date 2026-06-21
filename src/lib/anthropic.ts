// anthropic.ts — จัดหมวดด้วย Claude เฉพาะ "คำใหม่" ที่พจนานุกรมไม่รู้จัก (แล้ว cache ต่อกลุ่ม)
import Anthropic from "@anthropic-ai/sdk";
import { SEED, type TxType } from "@/data/categories.seed";

/** รายชื่อหมวดที่อนุญาต (สร้างจาก SEED) + ชุดตรวจความถูกต้อง */
function allowed(type: TxType): { list: string; valid: Set<string> } {
  const valid = new Set<string>();
  const lines: string[] = [];
  for (const e of SEED) {
    if (e.type !== type) continue;
    const label = e.sub ? `${e.cat} > ${e.sub}` : e.cat;
    valid.add(label);
    lines.push(label);
  }
  return { list: [...new Set(lines)].join("\n"), valid };
}

function extractJSON(text: string): string {
  const m = text.match(/\{[\s\S]*\}/);
  return m ? m[0] : "{}";
}

/** คืน {cat, sub} ถ้ามั่นใจ, หรือ null (ไม่มี key / ผิดพลาด / หมวดไม่อยู่ในรายการ) */
export async function llmCategorize(
  item: string,
  type: TxType,
): Promise<{ cat: string; sub: string | null } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const model = process.env.EUNJOD_CATEGORIZE_MODEL || "claude-haiku-4-5-20251001";
  const { list, valid } = allowed(type);

  const prompt =
    `จัดหมวด "${item}" (เป็นรายการ${type === "income" ? "รายรับ" : "รายจ่าย"}) ` +
    `โดยเลือกจากหมวดต่อไปนี้เท่านั้น:\n${list}\n\n` +
    `ตอบเป็น JSON อย่างเดียว: {"cat":"หมวดใหญ่","sub":"หมวดย่อยหรือ null"} ` +
    `ถ้าไม่เข้าหมวดไหนเลยให้ cat="อื่นๆ"`;

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model,
      max_tokens: 120,
      messages: [{ role: "user", content: prompt }],
    });
    const out = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const parsed = JSON.parse(extractJSON(out)) as { cat?: string; sub?: string | null };
    if (!parsed.cat) return null;
    const cat = String(parsed.cat).trim();
    const sub = parsed.sub ? String(parsed.sub).trim() : null;
    const label = sub ? `${cat} > ${sub}` : cat;
    if (cat === "อื่นๆ") return { cat: "อื่นๆ", sub: null };
    if (!valid.has(label) && !valid.has(cat)) return null; // กันหมวดมั่ว
    return { cat, sub };
  } catch (e) {
    console.error("[anthropic] categorize error:", (e as Error).message);
    return null;
  }
}

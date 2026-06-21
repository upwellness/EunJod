// ───────────────────────────────────────────────────────────────────────────
// parser.ts — แยกข้อความธรรมชาติ → รายการรายรับ/รายจ่าย
// pure module: ไม่มี dependency ภายนอก (เทสต์ได้ตรง ๆ)
// ───────────────────────────────────────────────────────────────────────────

export type TxType = "income" | "expense";

export interface ParsedEntry {
  type: TxType;
  amount: number;
  item: string;
  note?: string;
  raw: string;
}

/** คำที่บอกว่าเป็น "รายรับ" (นอกเหนือจากเครื่องหมาย +) */
const INCOME_WORDS = [
  "เงินเดือน", "โบนัส", "รายรับ", "เงินเข้า", "ขาย", "ขายของ", "ขายได้", "ยอดขาย",
  "รับเงิน", "ได้รับ", "ค่าคอม", "คอมมิชชั่น", "ทิป", "เงินคืน", "คืนเงิน", "ดอกเบี้ย",
  "เงินปันผล", "ปันผล", "salary", "bonus", "refund", "income",
];

/** ตัวคูณท้ายจำนวน */
const SUFFIX: Record<string, number> = {
  k: 1000, พัน: 1000, หมื่น: 10000, แสน: 100000, ล้าน: 1000000,
};

/** หน่วยที่ "ไม่ใช่เงิน" — ถ้าเลขตามด้วยคำพวกนี้ จะไม่นับเป็นจำนวนเงิน (กันจดเวลา/จำนวนคน) */
const NON_MONEY_UNIT =
  /^\s*(โมง|นาฬิกา|น\.|ทุ่ม|ชม\.?|ชั่วโมง|นาที|วินาที|คน|ท่าน|ปี|ขวบ|เดือน|วัน|กม\.?|กิโล|เมตร|ก\.?ก\.?|กรัม|%|เปอร์เซ็นต์|องศา)/;

interface AmountHit {
  value: number;
  start: number;
  end: number;
}

function pickAmount(s: string): AmountHit | null {
  const re = /(\d+(?:\.\d+)?)\s*(k|พัน|หมื่น|แสน|ล้าน)?/gi;
  const hits: { num: number; suf?: string; start: number; end: number; baht: boolean; unit: boolean }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m[0].length === 0) { re.lastIndex++; continue; }
    const after = s.slice(m.index + m[0].length);
    hits.push({
      num: parseFloat(m[1]),
      suf: m[2]?.toLowerCase(),
      start: m.index,
      end: m.index + m[0].length,
      baht: /^\s*(บาท|฿)/.test(after),
      unit: NON_MONEY_UNIT.test(after),
    });
  }
  // ตัดตัวที่เป็นหน่วยไม่ใช่เงินทิ้ง (เว้นแต่มีบาทกำกับ)
  const usable = hits.filter((h) => h.baht || !h.unit);
  if (usable.length === 0) return null;

  // ลำดับความสำคัญ: มี "บาท/฿" > มีตัวคูณ (k/พัน..) > ตัวเลขท้ายสุด
  const chosen =
    usable.find((h) => h.baht) || usable.find((h) => h.suf) || usable[usable.length - 1];

  const mult = chosen.suf ? SUFFIX[chosen.suf] : 1;
  let end = chosen.end;
  const tail = s.slice(end).match(/^\s*(บาท|฿)/);
  if (tail) end += tail[0].length;
  return { value: chosen.num * mult, start: chosen.start, end };
}

function parseSegment(seg: string): ParsedEntry | null {
  let work = seg;
  let note: string | undefined;

  // โน้ตหลัง # (หรือ //)
  const noteMatch = work.match(/[#]\s*(.+)$/) || work.match(/\/\/\s*(.+)$/);
  if (noteMatch) {
    note = noteMatch[1].trim() || undefined;
    work = work.slice(0, noteMatch.index).trim();
  }

  // เครื่องหมายกำหนดชนิดชัดเจน
  let force: TxType | undefined;
  const t = work.trimStart();
  if (t.startsWith("+")) { force = "income"; work = t.slice(1); }
  else if (t.startsWith("-") || t.startsWith("−")) { force = "expense"; work = t.slice(1); }

  const amt = pickAmount(work);
  if (!amt) return null;

  let item = (work.slice(0, amt.start) + " " + work.slice(amt.end))
    .replace(/\s+/g, " ")
    .replace(/^[+\-−]/, "")
    .trim();
  if (!item) item = "(ไม่ระบุ)";

  const hay = (item + " " + (note || "")).toLowerCase();
  const type: TxType = force ?? (INCOME_WORDS.some((w) => hay.includes(w)) ? "income" : "expense");

  return { type, amount: amt.value, item, note, raw: seg.trim() };
}

/**
 * แยกข้อความเป็นหลายรายการได้ (คั่นด้วย , ; หรือขึ้นบรรทัดใหม่)
 * คืน [] ถ้าไม่พบจำนวนเงินเลย → ผู้เรียกควร "เงียบ" ไม่จด
 */
export function parseMessage(text: string): ParsedEntry[] {
  // รวมตัวคั่นหลักพัน "1,000" -> "1000" ก่อน เพื่อไม่ให้ , ไปตัดผิด
  const cleaned = text.replace(/(\d),(\d)/g, "$1$2");
  const segments = cleaned.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  const out: ParsedEntry[] = [];
  for (const seg of segments) {
    const e = parseSegment(seg);
    if (e) out.push(e);
  }
  return out;
}

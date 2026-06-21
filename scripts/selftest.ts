// ───────────────────────────────────────────────────────────────────────────
// selftest.ts — ทดสอบแกนตรรกะแบบ offline (ไม่ต้องต่อ DB/LINE/Claude)
// รัน: npm test     (ผ่าน tsx)
//  หรือ: node --experimental-strip-types scripts/selftest.ts
// ───────────────────────────────────────────────────────────────────────────

import { parseMessage } from "../src/lib/parser";
import { SEED } from "../src/data/categories.seed";
import { buildDictionary, categorizeLocal, fallbackCat, catLabel, categoriesSummary, categoryGroups } from "../src/lib/categorize";

const dict = buildDictionary(SEED);
let pass = 0;
let fail = 0;

function check(name: string, cond: boolean, got?: unknown) {
  if (cond) { pass++; console.log("  ✓", name); }
  else { fail++; console.log("  ✗", name, got !== undefined ? `\n      got: ${JSON.stringify(got)}` : ""); }
}

function cat(item: string, type: "income" | "expense" = "expense"): string {
  const r = categorizeLocal(item, type, dict) ?? fallbackCat(type);
  return catLabel(r);
}

console.log("\n[1] การแยกข้อความ (parser)");
{
  const a = parseMessage("กาแฟ 50");
  check("'กาแฟ 50' -> 1 รายการ จ่าย 50 'กาแฟ'", a.length === 1 && a[0].type === "expense" && a[0].amount === 50 && a[0].item === "กาแฟ", a);

  const b = parseMessage("50 กาแฟ");
  check("'50 กาแฟ' (สลับ) -> จ่าย 50 'กาแฟ'", b.length === 1 && b[0].amount === 50 && b[0].item === "กาแฟ", b);

  const c = parseMessage("+เงินเดือน 30000");
  check("'+เงินเดือน 30000' -> รับ 30000", c.length === 1 && c[0].type === "income" && c[0].amount === 30000, c);

  const d = parseMessage("ข้าวเที่ยง 60 #ลูกค้า");
  check("'ข้าวเที่ยง 60 #ลูกค้า' -> โน้ต 'ลูกค้า'", d.length === 1 && d[0].amount === 60 && d[0].note === "ลูกค้า" && d[0].item === "ข้าวเที่ยง", d);

  const e = parseMessage("ข้าว 60, ทางด่วน 80, ชาจไฟ 120");
  check("หลายรายการคั่น , -> 3 รายการ [60,80,120]", e.length === 3 && e[0].amount === 60 && e[1].amount === 80 && e[2].amount === 120, e.map((x) => x.amount));

  const f = parseMessage("หิวจัง");
  check("'หิวจัง' (ไม่มีเลข) -> ไม่จด (0 รายการ)", f.length === 0, f);

  const g = parseMessage("กาแฟ 5k");
  check("'กาแฟ 5k' -> 5000", g.length === 1 && g[0].amount === 5000, g);

  const h = parseMessage("เบียร์ 1.5k");
  check("'เบียร์ 1.5k' -> 1500", h.length === 1 && h[0].amount === 1500, h);

  const i = parseMessage("เงินเดือน 2หมื่น");
  check("'เงินเดือน 2หมื่น' -> รับ 20000", i.length === 1 && i[0].type === "income" && i[0].amount === 20000, i);

  const j = parseMessage("ค่ากาแฟ 50 บาท");
  check("'ค่ากาแฟ 50 บาท' -> จ่าย 50", j.length === 1 && j[0].amount === 50, j);

  const k = parseMessage("ประชุม 10 โมง");
  check("'ประชุม 10 โมง' (เวลา ไม่ใช่เงิน) -> ไม่จด", k.length === 0, k);

  const l = parseMessage("ข้าว 1,200");
  check("'ข้าว 1,200' (คั่นหลักพัน) -> 1200", l.length === 1 && l[0].amount === 1200, l);

  const m = parseMessage("ขายของ 500");
  check("'ขายของ 500' -> รับ 500 (คำว่าขายของ)", m.length === 1 && m[0].type === "income" && m[0].amount === 500, m);
}

console.log("\n[2] การจัดหมวด (categorize) — ตัวอย่างตามโจทย์");
{
  check("กาแฟ -> กิน > เครื่องดื่ม", cat("กาแฟ") === "กิน > เครื่องดื่ม", cat("กาแฟ"));
  check("ทางด่วน -> เดินทาง > ทางด่วน", cat("ทางด่วน") === "เดินทาง > ทางด่วน", cat("ทางด่วน"));
  check("ชาจไฟ -> เดินทาง > น้ำมัน/ไฟ", cat("ชาจไฟ") === "เดินทาง > น้ำมัน/ไฟ", cat("ชาจไฟ"));
  check("เงินเดือน (income) -> เงินเดือน", cat("เงินเดือน", "income") === "เงินเดือน", cat("เงินเดือน", "income"));
}

console.log("\n[3] การจัดหมวด — เคสยาก/contains/variant");
{
  check("ข้าวเที่ยง -> กิน > อาหาร", cat("ข้าวเที่ยง") === "กิน > อาหาร", cat("ข้าวเที่ยง"));
  check("กาแฟเย็น -> กิน > เครื่องดื่ม (contains)", cat("กาแฟเย็น") === "กิน > เครื่องดื่ม", cat("กาแฟเย็น"));
  check("ค่าทางด่วน -> เดินทาง > ทางด่วน", cat("ค่าทางด่วน") === "เดินทาง > ทางด่วน", cat("ค่าทางด่วน"));
  check("ค่าไฟ -> บ้าน/บิล > ค่าน้ำ-ไฟ (ไม่หลุดไปชาร์จไฟ)", cat("ค่าไฟ") === "บ้าน/บิล > ค่าน้ำ-ไฟ", cat("ค่าไฟ"));
  check("ค่าน้ำ -> บ้าน/บิล > ค่าน้ำ-ไฟ (ไม่หลุดไปเครื่องดื่ม)", cat("ค่าน้ำ") === "บ้าน/บิล > ค่าน้ำ-ไฟ", cat("ค่าน้ำ"));
  check("แท็กซี่ -> เดินทาง > แท็กซี่/Grab", cat("แท็กซี่") === "เดินทาง > แท็กซี่/Grab", cat("แท็กซี่"));
  check("เติมน้ำมัน -> เดินทาง > น้ำมัน/ไฟ", cat("เติมน้ำมัน") === "เดินทาง > น้ำมัน/ไฟ", cat("เติมน้ำมัน"));
  check("xyzabc (ไม่รู้จัก) -> อื่นๆ", cat("xyzabc") === "อื่นๆ", cat("xyzabc"));
}

console.log("\n[4] รายการหมวด (/cats)");
{
  const s = categoriesSummary(SEED);
  check("มีหมวดใหญ่ครบ (กิน/เดินทาง/บ้าน/บิล)", s.includes("กิน") && s.includes("เดินทาง") && s.includes("บ้าน/บิล"));
  check("มีหมวดย่อย (เครื่องดื่ม/ทางด่วน)", s.includes("เครื่องดื่ม") && s.includes("ทางด่วน"));
  check("มีรายรับ (เงินเดือน) + ตัวอย่างตั้งงบ", s.includes("เงินเดือน") && s.includes("/budget"));

  const g = categoryGroups(SEED);
  const food = g.find((x) => x.cat === "กิน" && x.type === "expense");
  check("categoryGroups: กิน มี 3 หมวดย่อย", !!food && food.subs.length === 3);
  check("categoryGroups: มีกลุ่มรายรับ", g.some((x) => x.type === "income" && x.cat === "เงินเดือน"));
}

console.log(`\n=========== ผลรวม: ${pass} ผ่าน / ${fail} ตก ===========\n`);
if (fail > 0) process.exit(1);

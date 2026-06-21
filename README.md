# EunJod (น้องจด) 🧾

บอท LINE ที่เข้าไปอยู่ใน **กลุ่ม LINE** แล้วช่วย **จดรายรับ-รายจ่าย** จากข้อความที่พิมพ์
แค่พิมพ์ `กาแฟ 50` → บอทจดเป็นรายจ่าย 50 บาท หมวด *กิน > เครื่องดื่ม* ให้อัตโนมัติ

> สถานะ: 🛠️ **Build Phase 0–1 เสร็จ** — โค้ดพร้อม, ผ่าน unit test 25/25, build ผ่าน, webhook ตอบ 200
> เหลือใส่ค่า LINE OA + Supabase แล้ว deploy (ดู [คู่มือ Setup ใน SPEC §19](SPEC.md)) · สเปกอ่านง่าย: เปิด [`SPEC.html`](SPEC.html)

## ทำอะไรได้
- **จดเร็ว** — พิมพ์ `<รายการ> <จำนวน>` ไม่ต้องเลือกหมวด (รองรับ `5k`, `+` = รายรับ, หลายรายการคั่น `,`)
- **จัดหมวดอัตโนมัติ 4 ชั้น** — คำที่กลุ่มสอน → พจนานุกรมกลาง → คำใกล้เคียง → Claude (คำใหม่) แล้วจำ
- **แยกบัญชีต่อกลุ่ม** — `/setbook ชื่อบัญชี` ข้อมูลแต่ละกลุ่มไม่ปนกัน
- **รายงานรายเดือน** — พิมพ์ `รายงาน` ได้สรุป + ลิงก์หน้าเว็บกราฟ
- **เงียบเมื่อคุยเล่น** — ข้อความไม่มีตัวเลขเงิน บอทไม่จด

## คำสั่งย่อ
| อยากทำ | พิมพ์ |
|---|---|
| จดรายจ่าย | `กาแฟ 50` |
| จดรายรับ | `+เงินเดือน 30000` |
| จดย้อนหลังวัน | `กาแฟ 50 เมื่อวาน` · `ข้าว 60 12/6` |
| ลบล่าสุด | `ลบ` |
| แก้หมวด (บอทจำ) | `แก้หมวด เดินทาง > ทางด่วน` |
| ดูเดือนนี้ | `เดือนนี้` |
| รายงาน + กราฟ | `รายงาน` |
| ตั้งบัญชีกลุ่ม | `/setbook บ้านเรา` |
| ดูหมวดทั้งหมด | `/cats` |
| จัดหมวดรายการที่ค้าง (เว็บ) | `/review` |
| จัดการหมวด เปลี่ยนชื่อ/เพิ่ม/ซ่อน/ย้าย (เว็บ) | `/editcat` |
| ตั้งงบ | `/budget กิน 5000` |
| สอนหมวด | `/cat ชานม = กิน > เครื่องดื่ม` |
| คู่มือ | `/help` |

## โครงสร้างโปรเจกต์
```
src/
  app/
    api/line/webhook/route.ts   ← LINE webhook (ตรวจลายเซ็น → สมองบอท)
    r/[token]/page.tsx          ← หน้าเว็บรายงาน (กราฟ)
    page.tsx · layout.tsx       ← landing
  lib/
    parser.ts        ← แยกข้อความ → รายการ (pure, มี unit test)
    categorize.ts    ← จัดหมวดจากพจนานุกรม (pure, มี unit test)
    commands.ts      ← สมอง: routing คำสั่งทั้งหมด
    db.ts            ← Supabase + repository
    line.ts          ← ส่ง/ตอบ LINE + ตรวจลายเซ็น
    anthropic.ts     ← จัดหมวดคำใหม่ด้วย Claude
    reports.ts       ← ช่วงเวลา + สรุปยอด
  data/categories.seed.ts        ← พจนานุกรมหมวด "กลาง"
supabase/migrations/0001_init.sql ← schema
scripts/selftest.ts               ← unit test แกนตรรกะ
```

## รันในเครื่อง
```bash
npm install
cp .env.example .env.local      # แล้วเติมค่า (ดู SPEC §19)
npm test                        # ทดสอบ parser + categorize (offline, 25 เคส)
npm run dev                     # เปิดเว็บ + webhook ที่ http://localhost:3000
```
`npm run build` = ตรวจ + สร้าง production · `npm run typecheck` = ตรวจชนิดข้อมูล

## Deploy (สั้น ๆ)
1. เปิด **LINE OA ใหม่** → Messaging API → เก็บ Channel secret + access token
2. สร้าง **Supabase** → รัน `supabase/migrations/0001_init.sql`
3. ใส่ env แล้ว `vercel` deploy → เอา URL ไปตั้ง **Webhook URL** = `https://<โดเมน>/api/line/webhook` ที่ LINE
4. เปิด **Allow bot to join group chats** + ปิด auto-reply → ชวนบอทเข้ากลุ่ม → `/setbook`

รายละเอียดเต็ม: [`SPEC.md`](SPEC.md) · [`SPEC.html`](SPEC.html) · พจนานุกรมหมวด: [`categories.seed.md`](categories.seed.md)

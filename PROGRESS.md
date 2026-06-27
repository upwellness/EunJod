# EunJod (น้องจด) — PROGRESS / คู่มือหยิบมาทำต่อ

> 📌 ไฟล์นี้ = "จุดเริ่มเมื่อกลับมาทำต่อ" (pickup map) · คู่กับ [SPEC.md](SPEC.md) (รายละเอียดสเปก) + [SPEC.html](SPEC.html) (ฉบับอ่านง่าย)
> อัปเดตล่าสุด: 2026-06-23 · เวอร์ชัน 0.2.7 · สถานะ: 🟢 **LIVE ใช้งานจริง**

---

## 🎯 ระบบนี้คืออะไร
บอท LINE เข้า **กลุ่ม LINE** → จดรายรับ-รายจ่ายจากข้อความ + จัดหมวดอัตโนมัติ · แต่ละกลุ่ม = 1 บัญชี · มีหน้าเว็บจัดการ

- **Live:** https://eunjod.vercel.app · webhook `https://eunjod.vercel.app/api/line/webhook`
- **Repo:** https://github.com/upwellness/EunJod (branch `main`)

## ⚡ กลับมาทำต่อใน 5 บรรทัด
```bash
git clone https://github.com/upwellness/EunJod && cd EunJod
npm install
cp .env.example .env.local          # แล้วเติมค่า (ดูหัวข้อ Secrets)
npm test                            # ทดสอบแกน (ปัจจุบัน 44/44)
npm run dev                         # http://localhost:3000
```
ส่งขึ้น production: `vercel deploy --prod` (หรือแค่ push main → auto-deploy)

---

## 🧱 Stack & Infra (บัญชีที่ใช้)
| ส่วน | รายละเอียด |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| Hosting | **Vercel team `upwellness`** (slug `ultimatepassion`) · project `eunjod` · auto-deploy จาก GitHub |
| DB | **Supabase** project `xbrpbamohxtspjbkavuv` ("JinNoi Bot" — **ใช้ร่วมกับบอทอื่น**, ตาราง EunJod แยกชื่อไม่ชนกัน) |
| AI จัดหมวด | Claude Haiku (ผ่าน `ANTHROPIC_API_KEY` — ตอนนี้ยังไม่ได้ใส่ = ใช้พจนานุกรมอย่างเดียว) |
| Chat | LINE Messaging API (OA ใหม่ของ EunJod) |
| GitHub | `upwellness/EunJod` (push ต้องสลับ gh เป็น upwellness ก่อน) |

## 🔑 Secrets (ใส่ใน `.env.local` + Vercel production env)
`SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` · `LINE_CHANNEL_SECRET` · `LINE_CHANNEL_ACCESS_TOKEN` · `ANTHROPIC_API_KEY` (ออปชัน) · `EUNJOD_CATEGORIZE_MODEL` · `APP_BASE_URL`
> ค่าจริงอยู่ใน `.env.local` (gitignore) และตั้งบน Vercel production แล้ว · service_role/secret keys ดึงจาก dashboard ของแต่ละบริการ

---

## ✅ ฟีเจอร์ที่ทำแล้ว (ทั้งหมด deploy + ทดสอบ prod ผ่าน)
**จดเงิน (พิมพ์ในกลุ่ม):**
- `กาแฟ 50` · `+เงินเดือน 30000` · หลายรายการคั่น `,` · `#โน้ต`
- **ย้อนหลังวัน:** `กาแฟ 50 เมื่อวาน` · `ข้าว 60 12/6` · `3วันก่อน` · `d/m/ปี`
- เงียบเมื่อไม่มีตัวเลข · กันจดเวลา ("10 โมง") · เรียนรู้คำที่ผู้ใช้แก้

**ดู/สรุป:**
- `วันนี้` / `สิ้นวัน` / `เมื่อวาน` → **สรุปสิ้นวันลงรายการแยกหมวด** (ยอดย่อย+รวม)
- `เดือนนี้` / `สรุป` / `รายงาน` → สรุปยอด + ลิงก์กราฟเว็บ
- `หมวด กิน` · `ค้นหา กาแฟ` · `งบ` · `/cats`

**แก้ไข (แชต):** `ลบ` · `แก้ 70` · `แก้หมวด เดินทาง`
**ตั้งค่า:** `/setbook` · `/budget กิน 5000` · `/cat คำ = หมวด` · `/help`

**หน้าเว็บ (token-gated, ลิงก์หมดอายุ 7 วัน):**
- `/edit` → `/tx/[token]` — แก้ไขรายการที่จดแล้ว (เปลี่ยนหมวด/แก้ยอด-ชื่อ-วัน-โน้ต/ลบ)
- `/review` → `/review/[token]` — จัดหมวดรายการที่ยังลง "อื่นๆ" (เลือกแล้วบอทจำ)
- `/editcat` → `/categories/[token]` — จัดการหมวด (เปลี่ยนชื่อ/เพิ่ม/ซ่อน/ย้ายข้ามหมวด)
- `/r/[token]` — รายงานเดือน + กราฟ

## 🗂️ แผนผังไฟล์
```
src/lib/
  parser.ts        แยกข้อความ → รายการ (+ วันที่ย้อนหลัง)   [pure, มีเทสต์]
  categorize.ts    จัดหมวดจากพจนานุกรม (exact→contains)      [pure, มีเทสต์]
  categories.ts    config ต่อบัญชี: rename/add/hide          [pure, มีเทสต์]
  reports.ts       ช่วงเวลา(tz) + สรุปยอด + สรุปสิ้นวันลงรายการ [pure ส่วนใหญ่]
  commands.ts      สมองบอท: routing คำสั่งทั้งหมด
  db.ts            Supabase + repository (ทุก query)
  line.ts          ส่ง/ตอบ LINE + ตรวจลายเซ็น
  anthropic.ts     จัดหมวดคำใหม่ด้วย Claude
  money.ts · types.ts
src/data/categories.seed.ts   พจนานุกรมหมวด "กลาง" (แก้ที่นี่)
src/app/
  api/line/webhook · api/tx/manage · api/review/assign · api/categories/manage
  tx/[token] · review/[token] · categories/[token] · r/[token] · page.tsx
supabase/migrations/0001_init.sql
scripts/selftest.ts           รัน `npm test`
```

## 🚀 วิธีพัฒนา & ส่งขึ้น (flow ที่ใช้อยู่)
```bash
# แก้โค้ด → ตรวจ
npm run typecheck && npm test && npm run build
# commit + push (repo อยู่ใต้ upwellness — ต้องสลับ gh)
git add -A && git commit -m "..."
gh auth switch --user upwellness && git push origin main && gh auth switch --user tonpalearn
# deploy (หรือปล่อยให้ auto-deploy จาก push ก็ได้)
vercel deploy --prod --yes        # Vercel login ต้องเป็น upwellness/ultimatepassion
```
> **กฎ Living Document:** แก้พฤติกรรม/ขอบเขต → อัปเดต `SPEC.md` + `SPEC.html` + changelog ทุกครั้ง

## ⚠️ Gotchas (จุดที่เคยพลาด — อ่านก่อนแก้)
- **LINE API host = `api.line.me`** ไม่ใช่ `api.line.biz` (.biz = หน้า console) — เคยพิมพ์ผิดทำ reply ล้ม
- **เครื่อง local + sandbox resolve `api.line.me` ไม่ได้** (DNS เน็ตบล็อก) — ทดสอบ LINE จาก local ไม่ได้ แต่ Vercel เรียกได้ปกติ
- **git push:** repo เป็นของ team upwellness → ต้อง `gh auth switch --user upwellness` ก่อน push (เสร็จแล้วสลับกลับ tonpalearn)
- **Vercel:** ต้องอยู่ scope `ultimatepassion` (team upwellness) — `vercel switch ultimatepassion`
- **Supabase แชร์กับ "JinNoi Bot":** มีตารางบอทอื่น 12 ตัว (RLS ปิด — ไม่ใช่ของเรา **ห้ามแตะ**) · ตาราง EunJod 5 ตัว RLS เปิด → แอปใช้ **service_role** (bypass RLS)
- **ทดสอบกับ DB จริง:** ใช้ source_id ขึ้นต้น `C...test` แล้วลบเฉพาะของตัวเอง (อย่าลบ ledger จริงของต้น) · ระวัง CTE `delete` ใน statement เดียวกับ `insert` (เห็น snapshot ก่อน insert — ลบไม่โดน ต้องแยก statement)
- โฟลเดอร์อยู่ใต้ git repo ของ home — repo จริงคือ `.git` ใน EunJod เอง (init แยกแล้ว)

## ⏳ ยังไม่ทำ / ไอเดียทำต่อ (backlog)
- 🔔 **auto-post สรุปสิ้นวันเข้ากลุ่มอัตโนมัติ** (Vercel Cron + `/digest on|off` ต่อกลุ่ม) — *รอต้นเคาะเวลา (เช่น 21:00)* ← งานถัดไปที่คุยค้างไว้
- 🤖 เปิด AI จัดหมวดคำใหม่ (ใส่ `ANTHROPIC_API_KEY` + redeploy)
- 💳 งบเตือนเชิงรุก (แจ้งตอนใกล้/เกินทันทีที่จด — ตอนนี้โชว์ในคำยืนยัน)
- 🎴 การ์ด Flex สวย ๆ (ตอนนี้ตอบเป็น text + quick reply)
- ✏️ เปลี่ยนชื่อ "หมวดย่อย" ในหน้า /editcat (ตอนนี้ rename ได้เฉพาะหมวดใหญ่)
- 📤 `/export` CSV/Excel · `/forget` (ลบข้อมูลทั้งบัญชี ตาม PDPA) · `/tz`

## 🧪 สถานะทดสอบ
`npm test` = **44/44 ผ่าน** (parser · categorize · categories · daily-detail) · `npm run build` ผ่าน · prod e2e ผ่านทุกฟีเจอร์

-- ===========================================================================
-- EunJod (น้องจด) — schema เริ่มต้น
-- รันใน Supabase: SQL Editor → วางทั้งไฟล์ → Run  (หรือ supabase db push)
-- หมายเหตุ: พจนานุกรมหมวด "กลาง" อยู่ในโค้ด (src/data/categories.seed.ts)
--           ตาราง keywords เก็บเฉพาะคำที่ผู้ใช้สอน/AI เรียนรู้ "ต่อกลุ่ม"
-- ===========================================================================

create extension if not exists pgcrypto;

-- กลุ่ม LINE 1 กลุ่ม = 1 บัญชี (เล่ม)
create table if not exists ledgers (
  id            uuid primary key default gen_random_uuid(),
  source_id     text unique not null,            -- groupId / roomId / userId ของ LINE
  source_type   text not null default 'group',
  name          text not null,
  currency      text not null default 'THB',
  timezone      text not null default 'Asia/Bangkok',
  owner_user_id text,
  settings      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- รายการรายรับ/รายจ่าย
create table if not exists transactions (
  id                uuid primary key default gen_random_uuid(),
  ledger_id         uuid not null references ledgers(id) on delete cascade,
  user_id           text,
  display_name      text,
  type              text not null check (type in ('income','expense')),
  amount            numeric(14,2) not null,
  item              text not null,
  cat               text,                          -- หมวดใหญ่ (เก็บเป็นข้อความ)
  sub               text,                          -- หมวดย่อย
  note              text,
  occurred_at       timestamptz not null default now(),
  source_message_id text,
  raw_text          text,
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz                    -- soft delete
);
create index if not exists tx_ledger_time on transactions (ledger_id, occurred_at);
create index if not exists tx_ledger_live on transactions (ledger_id) where deleted_at is null;

-- พจนานุกรมที่เรียนรู้ต่อกลุ่ม (คำ -> หมวด)
create table if not exists keywords (
  id         uuid primary key default gen_random_uuid(),
  ledger_id  uuid references ledgers(id) on delete cascade,  -- null = กลาง (ปกติใช้จากโค้ด)
  keyword    text not null,
  type       text not null check (type in ('income','expense')),
  cat        text not null,
  sub        text,
  emoji      text,
  source     text not null default 'user',        -- seed / llm / user
  hits       int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists kw_lookup on keywords (ledger_id, keyword, type);

-- งบประมาณรายเดือนต่อหมวด (cat null = งบรวม)
create table if not exists budgets (
  id         uuid primary key default gen_random_uuid(),
  ledger_id  uuid not null references ledgers(id) on delete cascade,
  cat        text,
  period     text not null default 'month',
  amount     numeric(14,2) not null,
  created_at timestamptz not null default now()
);

-- ลิงก์เปิดหน้าเว็บรายงาน (หมดอายุได้)
create table if not exists report_tokens (
  id         uuid primary key default gen_random_uuid(),
  ledger_id  uuid not null references ledgers(id) on delete cascade,
  token      text unique not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

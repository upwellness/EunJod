import { ledgerByToken, recentTx } from "@/lib/db";
import { SEED } from "@/data/categories.seed";
import { effectiveGroups, readConfig } from "@/lib/categories";
import TxEditor from "./TxEditor";

export const dynamic = "force-dynamic";

function Box({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 text-center text-slate-300">
        {children}
      </div>
    </main>
  );
}

export default async function TxPage({ params }: { params: { token: string } }) {
  let ledger;
  try {
    ledger = await ledgerByToken(params.token);
  } catch {
    return <Box>⚠️ ระบบยังไม่พร้อม (ยังไม่ได้ตั้งค่าฐานข้อมูล)</Box>;
  }
  if (!ledger) return <Box>🔒 ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว</Box>;

  const txs = await recentTx(ledger.id);
  const groups = effectiveGroups(SEED, readConfig(ledger.settings));
  const items = txs.map((t) => ({
    id: t.id,
    item: t.item,
    type: t.type,
    amount: Number(t.amount),
    cat: t.cat,
    sub: t.sub,
    note: t.note,
    occurred_at: t.occurred_at,
  }));

  return (
    <TxEditor token={params.token} ledgerName={ledger.name} timezone={ledger.timezone} items={items} groups={groups} />
  );
}

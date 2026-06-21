import { ledgerByToken, uncategorizedTx } from "@/lib/db";
import { categoryGroups } from "@/lib/categorize";
import { SEED } from "@/data/categories.seed";
import ReviewList from "./ReviewList";

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

export default async function ReviewPage({ params }: { params: { token: string } }) {
  let ledger;
  try {
    ledger = await ledgerByToken(params.token);
  } catch {
    return <Box>⚠️ ระบบยังไม่พร้อม (ยังไม่ได้ตั้งค่าฐานข้อมูล)</Box>;
  }
  if (!ledger) return <Box>🔒 ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว</Box>;

  const txs = await uncategorizedTx(ledger.id);
  const groups = categoryGroups(SEED);
  const items = txs.map((t) => ({
    id: t.id,
    item: t.item,
    type: t.type,
    amount: Number(t.amount),
    note: t.note,
    occurred_at: t.occurred_at,
  }));

  return (
    <ReviewList token={params.token} ledgerName={ledger.name} items={items} groups={groups} />
  );
}

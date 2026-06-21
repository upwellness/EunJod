import { ledgerByToken, txInRange } from "@/lib/db";
import { localRange, aggregate } from "@/lib/reports";
import { formatTHB } from "@/lib/money";

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

export default async function ReportPage({ params }: { params: { token: string } }) {
  let ledger;
  try {
    ledger = await ledgerByToken(params.token);
  } catch {
    return <Box>⚠️ ระบบรายงานยังไม่พร้อม (ยังไม่ได้ตั้งค่าฐานข้อมูล)</Box>;
  }
  if (!ledger) return <Box>🔒 ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว</Box>;

  const r = localRange(ledger.timezone, "month");
  const txs = await txInRange(ledger.id, r.start.toISOString(), r.end.toISOString());
  const s = aggregate(txs);
  const max = s.byCat.length ? s.byCat[0][1] : 1;

  return (
    <main className="min-h-screen p-5 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-5">
        <header className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          <div className="flex items-center gap-2 text-sm text-slate-400">🧾 EunJod · รายงาน</div>
          <h1 className="text-2xl font-bold text-white mt-1">{ledger.name}</h1>
          <div className="text-sm text-slate-400">{r.label}</div>
          <div className="grid grid-cols-3 gap-3 mt-5 text-center">
            <div className="rounded-2xl bg-black/30 p-3">
              <div className="text-xs text-slate-400">รายรับ</div>
              <div className="text-lg font-bold text-emerald-400">+{formatTHB(s.income)}</div>
            </div>
            <div className="rounded-2xl bg-black/30 p-3">
              <div className="text-xs text-slate-400">รายจ่าย</div>
              <div className="text-lg font-bold text-rose-400">−{formatTHB(s.expense)}</div>
            </div>
            <div className="rounded-2xl bg-black/30 p-3">
              <div className="text-xs text-slate-400">คงเหลือ</div>
              <div className={`text-lg font-bold ${s.net >= 0 ? "text-jade-300" : "text-amber-400"}`}>
                {s.net >= 0 ? "+" : "−"}{formatTHB(Math.abs(s.net))}
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          <h2 className="font-semibold text-white mb-4">รายจ่ายแยกหมวด</h2>
          {s.byCat.length === 0 && <div className="text-slate-500 text-sm">ยังไม่มีรายการ</div>}
          <div className="space-y-3">
            {s.byCat.map(([k, v]) => (
              <div key={k}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300">{k}</span>
                  <span className="text-slate-400">−{formatTHB(v)} ({Math.round((v / (s.expense || 1)) * 100)}%)</span>
                </div>
                <div className="h-2.5 rounded-full bg-black/40 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-jade-400 to-jade-600" style={{ width: `${Math.max(4, (v / max) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          <h2 className="font-semibold text-white mb-3">รายการล่าสุด</h2>
          <div className="divide-y divide-white/5">
            {txs.slice(-25).reverse().map((t) => (
              <div key={t.id} className="flex justify-between py-2 text-sm">
                <span className="text-slate-300">{t.item} <span className="text-slate-600 text-xs">{t.sub ? `${t.cat}>${t.sub}` : t.cat}</span></span>
                <span className={t.type === "income" ? "text-emerald-400" : "text-rose-400"}>
                  {t.type === "income" ? "+" : "−"}{formatTHB(Number(t.amount))}
                </span>
              </div>
            ))}
            {txs.length === 0 && <div className="text-slate-500 text-sm py-2">ยังไม่มีรายการ</div>}
          </div>
        </section>

        <footer className="text-center text-xs text-slate-600 pb-6">EunJod (น้องจด) · ลิงก์นี้หมดอายุใน 7 วัน</footer>
      </div>
    </main>
  );
}

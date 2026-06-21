"use client";

import { useState } from "react";
import type { CatGroup } from "@/lib/categorize";
import { formatTHB } from "@/lib/money";

interface Item {
  id: string;
  item: string;
  type: "income" | "expense";
  amount: number;
  note: string | null;
  occurred_at: string;
}

export default function ReviewList({
  token,
  ledgerName,
  items,
  groups,
}: {
  token: string;
  ledgerName: string;
  items: Item[];
  groups: CatGroup[];
}) {
  const [rows, setRows] = useState<Item[]>(items);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState(0);

  async function assign(tx: Item) {
    const category = sel[tx.id];
    if (!category) return;
    setBusy(tx.id);
    try {
      const res = await fetch("/api/review/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, txId: tx.id, category }),
      });
      if (res.ok) {
        setRows((r) => r.filter((x) => x.id !== tx.id));
        setDone((d) => d + 1);
      } else {
        alert("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
      }
    } catch {
      alert("เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen p-5 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-5">
        <header className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          <div className="text-sm text-slate-400">🧾 EunJod · จัดหมวดรายการ</div>
          <h1 className="text-2xl font-bold text-white mt-1">{ledgerName}</h1>
          <p className="text-sm text-slate-400 mt-1">
            เลือกหมวดให้แต่ละรายการ — บอทจะ<span className="text-jade-300">จำคำไว้</span> ครั้งหน้าจัดให้อัตโนมัติ
          </p>
          <div className="mt-4 flex gap-3">
            <div className="rounded-2xl bg-black/30 px-4 py-2 text-center">
              <div className="text-xl font-bold text-white">{rows.length}</div>
              <div className="text-[11px] text-slate-400">รอจัดหมวด</div>
            </div>
            <div className="rounded-2xl bg-black/30 px-4 py-2 text-center">
              <div className="text-xl font-bold text-jade-300">{done}</div>
              <div className="text-[11px] text-slate-400">จัดแล้ว</div>
            </div>
          </div>
        </header>

        {rows.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-10 text-center">
            <div className="text-5xl mb-3">🎉</div>
            <div className="text-white font-semibold">จัดหมวดครบแล้ว!</div>
            <div className="text-slate-400 text-sm mt-1">ไม่มีรายการที่ต้องจัดหมวดในตอนนี้</div>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((tx) => {
              const opts = groups.filter((g) => g.type === tx.type);
              return (
                <div key={tx.id} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-white font-medium truncate">{tx.item}</div>
                      <div className="text-xs text-slate-500">
                        {tx.note ? `#${tx.note} · ` : ""}
                        {new Date(tx.occurred_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                      </div>
                    </div>
                    <div className={`font-semibold shrink-0 ${tx.type === "income" ? "text-emerald-400" : "text-rose-400"}`}>
                      {tx.type === "income" ? "+" : "−"}{formatTHB(tx.amount)}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <select
                      value={sel[tx.id] ?? ""}
                      onChange={(e) => setSel((s) => ({ ...s, [tx.id]: e.target.value }))}
                      className="flex-1 min-w-0 rounded-xl bg-black/40 border border-white/10 text-slate-200 text-sm px-3 py-2 focus:outline-none focus:border-jade-400"
                    >
                      <option value="">— เลือกหมวด —</option>
                      {opts.map((g) => (
                        <optgroup key={g.cat} label={`${g.emoji} ${g.cat}`}>
                          {g.subs.map((s) => (
                            <option key={s} value={`${g.cat}>${s}`}>{`${g.cat} › ${s}`}</option>
                          ))}
                          <option value={g.cat}>{g.subs.length ? `${g.cat} (ทั่วไป)` : g.cat}</option>
                        </optgroup>
                      ))}
                    </select>
                    <button
                      onClick={() => assign(tx)}
                      disabled={!sel[tx.id] || busy === tx.id}
                      className="shrink-0 rounded-xl px-4 py-2 text-sm font-medium bg-jade-500/20 text-jade-300 border border-jade-500/30 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-jade-500/30 transition"
                    >
                      {busy === tx.id ? "…" : "บันทึก"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <footer className="text-center text-xs text-slate-600 pb-6">
          EunJod (น้องจด) · จัดเสร็จแล้วพิมพ์ <code>รายงาน</code> ในกลุ่มเพื่อดูสรุป
        </footer>
      </div>
    </main>
  );
}

"use client";

import { useState } from "react";
import type { CatGroup } from "@/lib/categorize";

interface Item {
  id: string;
  item: string;
  type: "income" | "expense";
  amount: number;
  cat: string | null;
  sub: string | null;
  note: string | null;
  occurred_at: string;
}

interface Draft {
  item: string;
  type: "income" | "expense";
  amount: string;
  cat: string;
  sub: string;
  note: string;
  date: string;
  origDate: string;
}

const val = (type: string, cat: string, sub: string) => `${type}|${cat}|${sub}`;

export default function TxEditor({
  token,
  ledgerName,
  timezone,
  items,
  groups,
}: {
  token: string;
  ledgerName: string;
  timezone: string;
  items: Item[];
  groups: CatGroup[];
}) {
  const dateStr = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: timezone });

  const init: Record<string, Draft> = {};
  for (const t of items) {
    const d = dateStr(t.occurred_at);
    init[t.id] = {
      item: t.item,
      type: t.type,
      amount: String(t.amount),
      cat: t.cat ?? "อื่นๆ",
      sub: t.sub ?? "",
      note: t.note ?? "",
      date: d,
      origDate: d,
    };
  }

  const [rows, setRows] = useState<Item[]>(items);
  const [draft, setDraft] = useState<Record<string, Draft>>(init);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const expenseOpts = groups.filter((g) => g.type === "expense");
  const incomeOpts = groups.filter((g) => g.type === "income");

  function set(id: string, patch: Partial<Draft>) {
    setDraft((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  }

  async function save(t: Item) {
    const d = draft[t.id];
    setBusy(t.id);
    const payload: Record<string, string> = {
      token,
      action: "update",
      txId: t.id,
      item: d.item,
      amount: d.amount,
      type: d.type,
      cat: d.cat,
      sub: d.sub,
      note: d.note,
    };
    if (d.date && d.date !== d.origDate) payload.date = d.date;
    try {
      const res = await fetch("/api/tx/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        set(t.id, { origDate: d.date });
        setSaved(t.id);
        setTimeout(() => setSaved((x) => (x === t.id ? null : x)), 1500);
      } else {
        alert("บันทึกไม่สำเร็จ");
      }
    } catch {
      alert("เชื่อมต่อไม่ได้");
    } finally {
      setBusy(null);
    }
  }

  async function del(t: Item) {
    if (!window.confirm(`ลบรายการ "${draft[t.id]?.item}" ?`)) return;
    setBusy(t.id);
    try {
      const res = await fetch("/api/tx/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "delete", txId: t.id }),
      });
      if (res.ok) setRows((r) => r.filter((x) => x.id !== t.id));
      else alert("ลบไม่สำเร็จ");
    } catch {
      alert("เชื่อมต่อไม่ได้");
    } finally {
      setBusy(null);
    }
  }

  const fld = "rounded-xl bg-black/40 border border-white/10 text-slate-200 text-sm px-3 py-2 focus:outline-none focus:border-jade-400";

  return (
    <main className="min-h-screen p-5 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-5">
        <header className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          <div className="text-sm text-slate-400">🧾 EunJod · แก้ไขรายการ</div>
          <h1 className="text-2xl font-bold text-white mt-1">{ledgerName}</h1>
          <p className="text-sm text-slate-400 mt-1">เลือกรายการที่จดแล้ว → เปลี่ยนหมวด / แก้ยอด-ชื่อ-วัน / ลบ ({rows.length} รายการล่าสุด)</p>
        </header>

        {rows.length === 0 && (
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-10 text-center text-slate-400">
            ยังไม่มีรายการ
          </div>
        )}

        <div className="space-y-3">
          {rows.map((t) => {
            const d = draft[t.id];
            const cur = val(d.type, d.cat, d.sub);
            const known =
              [...expenseOpts, ...incomeOpts].some((g) => val(g.type, g.cat, "") === cur || g.subs.some((s) => val(g.type, g.cat, s) === cur));
            return (
              <div key={t.id} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 space-y-2">
                <input className={`${fld} w-full`} value={d.item} onChange={(e) => set(t.id, { item: e.target.value })} placeholder="ชื่อรายการ" />
                <div className="flex gap-2">
                  <div className="flex items-center gap-1 flex-1">
                    <span className={d.type === "income" ? "text-emerald-400" : "text-rose-400"}>{d.type === "income" ? "+" : "−"}</span>
                    <input className={`${fld} w-full`} type="number" inputMode="decimal" value={d.amount} onChange={(e) => set(t.id, { amount: e.target.value })} placeholder="จำนวน" />
                  </div>
                  <input className={`${fld} flex-1`} type="date" value={d.date} onChange={(e) => set(t.id, { date: e.target.value })} />
                </div>
                <select
                  className={`${fld} w-full`}
                  value={cur}
                  onChange={(e) => {
                    const [type, cat, sub] = e.target.value.split("|");
                    set(t.id, { type: type as "income" | "expense", cat, sub });
                  }}
                >
                  {!known && <option value={cur}>(ปัจจุบัน) {d.cat}{d.sub ? ` › ${d.sub}` : ""}</option>}
                  <optgroup label="— รายจ่าย —">
                    {expenseOpts.map((g) => [
                      <option key={`${g.cat}|`} value={val("expense", g.cat, "")}>{g.emoji} {g.cat}</option>,
                      ...g.subs.map((s) => <option key={`${g.cat}|${s}`} value={val("expense", g.cat, s)}>{`　└ ${s}`}</option>),
                    ])}
                  </optgroup>
                  <optgroup label="— รายรับ —">
                    {incomeOpts.map((g) => (
                      <option key={`i${g.cat}`} value={val("income", g.cat, "")}>{g.emoji} {g.cat}</option>
                    ))}
                  </optgroup>
                </select>
                <input className={`${fld} w-full`} value={d.note} onChange={(e) => set(t.id, { note: e.target.value })} placeholder="โน้ต (ไม่ใส่ก็ได้)" />
                <div className="flex gap-2 justify-end items-center">
                  {saved === t.id && <span className="text-jade-300 text-sm">✓ บันทึกแล้ว</span>}
                  <button disabled={busy === t.id} onClick={() => del(t)} className="rounded-lg px-3 py-1.5 text-sm border bg-rose-500/10 text-rose-300 border-rose-500/20 disabled:opacity-40">ลบ</button>
                  <button disabled={busy === t.id} onClick={() => save(t)} className="rounded-lg px-4 py-1.5 text-sm font-medium border bg-jade-500/20 text-jade-300 border-jade-500/30 disabled:opacity-40">
                    {busy === t.id ? "…" : "บันทึก"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <footer className="text-center text-xs text-slate-600 pb-6">EunJod (น้องจด) · เปลี่ยนหมวดแล้วบอทจะจำคำไว้ให้</footer>
      </div>
    </main>
  );
}

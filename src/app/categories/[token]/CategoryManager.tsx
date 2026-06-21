"use client";

import { useState } from "react";
import type { CatGroup } from "@/lib/categorize";

export default function CategoryManager({
  token,
  ledgerName,
  groups,
  hidden,
  used,
}: {
  token: string;
  ledgerName: string;
  groups: CatGroup[];
  hidden: string[];
  used: Record<string, number>;
}) {
  const [busy, setBusy] = useState(false);
  const [addType, setAddType] = useState<"expense" | "income">("expense");
  const [addCat, setAddCat] = useState("");
  const [addSub, setAddSub] = useState("");
  const [moveFrom, setMoveFrom] = useState("");
  const [moveTo, setMoveTo] = useState("");

  const expense = groups.filter((g) => g.type === "expense");
  const income = groups.filter((g) => g.type === "income");
  const allCats = groups.map((g) => g.cat);

  async function post(payload: Record<string, string>) {
    setBusy(true);
    try {
      const res = await fetch("/api/categories/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...payload }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const e = await res.json().catch(() => ({}));
        alert("ไม่สำเร็จ: " + (e.error || res.status));
        setBusy(false);
      }
    } catch {
      alert("เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง");
      setBusy(false);
    }
  }

  function rename(cat: string) {
    const nn = window.prompt(`เปลี่ยนชื่อหมวด "${cat}" เป็น:`, cat);
    if (nn && nn.trim() && nn.trim() !== cat) post({ action: "rename", oldName: cat, newName: nn.trim() });
  }

  const card = "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5";
  const btn = "rounded-lg px-3 py-1.5 text-xs border transition disabled:opacity-40";

  function CatRow({ g }: { g: CatGroup }) {
    const n = used[g.cat] ?? 0;
    return (
      <div className="flex items-center justify-between gap-2 py-2 border-b border-white/5 last:border-0">
        <div className="min-w-0">
          <div className="text-white text-sm truncate">
            {g.emoji} {g.cat} {n > 0 && <span className="text-slate-500 text-xs">· {n} รายการ</span>}
          </div>
          {g.subs.length > 0 && <div className="text-xs text-slate-500 truncate">{g.subs.join(" · ")}</div>}
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button disabled={busy} onClick={() => rename(g.cat)} className={`${btn} bg-jade-500/15 text-jade-300 border-jade-500/25`}>แก้ชื่อ</button>
          <button disabled={busy} onClick={() => post({ action: "hide", label: g.cat })} className={`${btn} bg-white/5 text-slate-400 border-white/10`}>ซ่อน</button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-5 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-5">
        <header className={card}>
          <div className="text-sm text-slate-400">🧾 EunJod · จัดการหมวด</div>
          <h1 className="text-2xl font-bold text-white mt-1">{ledgerName}</h1>
          <p className="text-sm text-slate-400 mt-1">เปลี่ยนชื่อ · เพิ่ม · ซ่อน · ย้ายรายการข้ามหมวด</p>
        </header>

        {/* เพิ่มหมวด */}
        <section className={card}>
          <h2 className="font-semibold text-white mb-3">➕ เพิ่มหมวด / หมวดย่อย</h2>
          <div className="flex flex-wrap gap-2">
            <select value={addType} onChange={(e) => setAddType(e.target.value as "expense" | "income")} className="rounded-xl bg-black/40 border border-white/10 text-slate-200 text-sm px-3 py-2">
              <option value="expense">รายจ่าย</option>
              <option value="income">รายรับ</option>
            </select>
            <input value={addCat} onChange={(e) => setAddCat(e.target.value)} placeholder="ชื่อหมวดใหญ่" className="flex-1 min-w-[120px] rounded-xl bg-black/40 border border-white/10 text-slate-200 text-sm px-3 py-2" />
            <input value={addSub} onChange={(e) => setAddSub(e.target.value)} placeholder="หมวดย่อย (ไม่ใส่ก็ได้)" className="flex-1 min-w-[120px] rounded-xl bg-black/40 border border-white/10 text-slate-200 text-sm px-3 py-2" />
            <button
              disabled={busy || !addCat.trim()}
              onClick={() => post({ action: "add", type: addType, cat: addCat.trim(), sub: addSub.trim() })}
              className={`${btn} bg-jade-500/20 text-jade-300 border-jade-500/30 px-4 py-2`}
            >
              เพิ่ม
            </button>
          </div>
        </section>

        {/* ย้ายข้ามหมวด */}
        <section className={card}>
          <h2 className="font-semibold text-white mb-3">🔀 ย้ายรายการทั้งหมดข้ามหมวด</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select value={moveFrom} onChange={(e) => setMoveFrom(e.target.value)} className="flex-1 min-w-[120px] rounded-xl bg-black/40 border border-white/10 text-slate-200 text-sm px-3 py-2">
              <option value="">จากหมวด…</option>
              {allCats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="text-slate-500">→</span>
            <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="flex-1 min-w-[120px] rounded-xl bg-black/40 border border-white/10 text-slate-200 text-sm px-3 py-2">
              <option value="">ไปหมวด…</option>
              {allCats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              disabled={busy || !moveFrom || !moveTo || moveFrom === moveTo}
              onClick={() => { if (window.confirm(`ย้ายทุกรายการจาก "${moveFrom}" ไป "${moveTo}"?`)) post({ action: "move", fromCat: moveFrom, toCat: moveTo }); }}
              className={`${btn} bg-amber-500/20 text-amber-300 border-amber-500/30 px-4 py-2`}
            >
              ย้าย
            </button>
          </div>
        </section>

        {/* รายการหมวด */}
        <section className={card}>
          <h2 className="font-semibold text-white mb-2">💸 หมวดรายจ่าย</h2>
          {expense.map((g) => <CatRow key={g.cat} g={g} />)}
        </section>
        <section className={card}>
          <h2 className="font-semibold text-white mb-2">💵 หมวดรายรับ</h2>
          {income.map((g) => <CatRow key={g.cat} g={g} />)}
        </section>

        {/* ซ่อนอยู่ */}
        {hidden.length > 0 && (
          <section className={card}>
            <h2 className="font-semibold text-white mb-2">🙈 ซ่อนอยู่</h2>
            {hidden.map((label) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <span className="text-slate-400 text-sm">{label}</span>
                <button disabled={busy} onClick={() => post({ action: "unhide", label })} className={`${btn} bg-jade-500/15 text-jade-300 border-jade-500/25`}>แสดง</button>
              </div>
            ))}
          </section>
        )}

        <footer className="text-center text-xs text-slate-600 pb-6">
          EunJod (น้องจด) · เปลี่ยนชื่อแล้วมีผลทั้งรายการเก่าและรายการใหม่
        </footer>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 text-center">
        <div className="text-5xl mb-3">🧾</div>
        <h1 className="text-3xl font-bold text-white">EunJod <span className="text-slate-500 text-xl">น้องจด</span></h1>
        <p className="mt-3 text-slate-400">
          บอท LINE จดรายรับ-รายจ่ายในกลุ่ม พร้อมจัดหมวดอัตโนมัติ
        </p>
        <div className="mt-6 rounded-2xl bg-black/30 p-4 text-left text-sm text-slate-300 space-y-1.5">
          <div>พิมพ์ในกลุ่ม:</div>
          <div className="font-mono text-jade-300">กาแฟ 50</div>
          <div className="font-mono text-jade-300">ข้าว 60, ทางด่วน 80</div>
          <div className="font-mono text-jade-300">+เงินเดือน 30000</div>
          <div className="text-slate-500 pt-1">เริ่มต้น: /setbook ชื่อบัญชี · /help</div>
        </div>
        <p className="mt-6 text-xs text-slate-600">
          สถานะระบบ: ทำงาน · Webhook: <code className="text-slate-400">/api/line/webhook</code>
        </p>
      </div>
    </main>
  );
}

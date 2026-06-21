import { ledgerByToken, usedCategories } from "@/lib/db";
import { SEED } from "@/data/categories.seed";
import { effectiveGroups, readConfig } from "@/lib/categories";
import CategoryManager from "./CategoryManager";

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

export default async function CategoriesPage({ params }: { params: { token: string } }) {
  let ledger;
  try {
    ledger = await ledgerByToken(params.token);
  } catch {
    return <Box>⚠️ ระบบยังไม่พร้อม (ยังไม่ได้ตั้งค่าฐานข้อมูล)</Box>;
  }
  if (!ledger) return <Box>🔒 ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว</Box>;

  const config = readConfig(ledger.settings);
  const groups = effectiveGroups(SEED, config);
  const used = await usedCategories(ledger.id);

  return (
    <CategoryManager
      token={params.token}
      ledgerName={ledger.name}
      groups={groups}
      hidden={config.hidden}
      used={used}
    />
  );
}

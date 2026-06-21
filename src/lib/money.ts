/** จัดรูปแบบเงินบาท เช่น 1234.5 -> "1,234.50" (ตัด .00 ออกถ้าเป็นจำนวนเต็ม) */
export function formatTHB(n: number): string {
  const neg = n < 0;
  const abs = Math.abs(n);
  const hasFraction = Math.round(abs * 100) % 100 !== 0;
  const s = abs.toLocaleString("en-US", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return (neg ? "-" : "") + s;
}

/** "−50" / "+30,000" สำหรับแสดงในการ์ด */
export function signed(type: "income" | "expense", amount: number): string {
  return (type === "income" ? "+" : "−") + formatTHB(amount);
}

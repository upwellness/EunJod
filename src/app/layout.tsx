import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "EunJod (น้องจด) — บอทจดรายรับรายจ่าย",
  description: "บอท LINE ที่ช่วยจดรายรับ-รายจ่ายในกลุ่ม พร้อมจัดหมวดอัตโนมัติ",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="text-slate-200 antialiased">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "StockInsight AI",
  description: "개인화 AI 주식 리포트 자동화 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground font-sans">
        <div className="app-bg-pattern" aria-hidden />
        <Sidebar />
        <div className="relative z-10 ml-[260px] min-h-screen">
          <div className="px-8 py-6">
            <Header />
            <main className="rounded-[40px] bg-card shadow-[var(--shadow-card)] p-6 min-h-[calc(100vh-120px)]">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}

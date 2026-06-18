'use client';

import { useState, useEffect } from "react";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 로컬 스토리지에서 이전 상태 불러오기
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved) setIsCollapsed(saved === 'true');
  }, []);

  const handleToggle = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  };

  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground font-sans">
        <div className="app-bg-pattern" aria-hidden />
        <Sidebar isCollapsed={isCollapsed} onToggle={handleToggle} />
        <div 
          className={cn(
            "relative z-10 min-h-screen transition-all duration-300 ease-in-out",
            isCollapsed ? "ml-[80px]" : "ml-[260px]"
          )}
        >
          <div className="px-8 py-6">
            <Header />
            <main className="rounded-[40px] bg-card shadow-[var(--shadow-card)] p-6 min-h-[calc(100vh-120px)] border-2 border-border-dark">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}

import { cn } from "@/lib/cn";

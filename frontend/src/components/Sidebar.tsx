'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import {
  LayoutDashboard,
  Star,
  Compass,
  Settings,
  LogOut,
  TrendingUp,
  ChevronRight,
  HardDriveDownload,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatPercent } from '@/lib/format';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/watchlist', label: '관심종목', icon: Star },
  { href: '/discover', label: '종목 탐색', icon: Compass },
  { href: '/data', label: '데이터 로딩', icon: HardDriveDownload },
];

interface Stock {
  ticker: string;
  name: string;
  current_price?: number;
  change_rate: number;
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data: watchlist } = useSWR<Stock[]>('/stocks', fetcher);

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-full w-[260px] flex-col bg-sidebar shadow-[4px_0_24px_rgba(167,139,250,0.06)]">
      <div className="flex items-center gap-3 px-6 py-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#a78bfa] to-[#f472b6] shadow-[0_4px_12px_rgba(109,40,217,0.4)]">
          <TrendingUp className="h-5 w-5 text-white" strokeWidth={1.5} />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-semibold tracking-tight text-foreground">
            Stock<span className="text-primary">Insight</span>
          </span>
          <span className="text-[10px] font-medium text-muted">AI 주식 리포트</span>
        </div>
      </div>

      <nav className="space-y-1.5 px-4 py-8">
        <div className="mb-4 px-4 text-[11px] font-medium text-muted">메인 메뉴</div>
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center justify-between rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all duration-200 group',
                isActive
                  ? 'bg-sidebar-active text-primary shadow-sm'
                  : 'text-muted hover:bg-sidebar-hover hover:text-foreground'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon size={20} strokeWidth={1.5} className={isActive ? 'text-primary' : 'text-muted group-hover:text-foreground'} />
                {label}
              </div>
              {isActive && <ChevronRight size={16} className="text-primary/60" />}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1 overflow-y-auto px-4 py-2 scrollbar-hide">
        <div className="mb-4 flex items-center justify-between px-4">
          <span className="text-[11px] font-medium text-muted">관심종목</span>
          <Link href="/watchlist" className="text-[11px] font-semibold text-primary hover:text-primary-hover transition-colors">전체 보기</Link>
        </div>
        <div className="space-y-1.5">
          {watchlist?.slice(0, 8).map((stock) => (
            <Link
              key={stock.ticker}
              href={`/stocks/${stock.ticker}`}
              className={cn(
                "group flex items-center justify-between rounded-2xl px-4 py-3 transition-all",
                pathname === `/stocks/${stock.ticker}`
                  ? "bg-card shadow-[var(--shadow-soft)] text-foreground"
                  : "hover:bg-sidebar-hover"
              )}
            >
              <div className="flex flex-col">
                <span className={cn(
                  "text-xs font-semibold transition-colors",
                  pathname === `/stocks/${stock.ticker}` ? "text-primary" : "text-foreground group-hover:text-primary"
                )}>{stock.ticker}</span>
                <span className="text-[10px] font-medium text-muted truncate w-28">{stock.name}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className={cn(
                  "text-[11px] font-semibold",
                  stock.change_rate > 0 ? "text-up" : stock.change_rate < 0 ? "text-down" : "text-muted"
                )}>
                  {formatPercent(stock.change_rate)}
                </span>
              </div>
            </Link>
          ))}
          {(!watchlist || watchlist.length === 0) && (
            <div className="px-3 py-4 text-center">
              <p className="text-[10px] font-medium text-muted italic">등록된 종목 없음</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-1 bg-sidebar">
        <Link
          href="/settings"
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-semibold text-muted transition-colors hover:bg-sidebar-hover hover:text-foreground"
        >
          <Settings size={18} strokeWidth={1.5} className="text-muted" />
          시스템 설정
        </Link>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-semibold text-muted transition-colors hover:bg-[#fde8e8] hover:text-up"
        >
          <LogOut size={18} strokeWidth={1.5} className="text-up/70" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}

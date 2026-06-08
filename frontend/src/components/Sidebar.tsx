'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import {
  LayoutDashboard,
  Star,
  Compass,
  Newspaper,
  Settings,
  LogOut,
  TrendingUp,
  Search,
  ChevronRight
} from 'lucide-react';
import { clsx } from 'clsx';
import { formatPercent } from '@/lib/format';

const navItems = [
  { href: '/', label: '대시보드', icon: LayoutDashboard },
  { href: '/watchlist', label: '관심종목', icon: Star },
  { href: '/discover', label: '종목 탐색', icon: Compass },
  { href: '/news', label: '뉴스 허브', icon: Newspaper },
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
    <aside className="fixed left-0 top-0 z-40 flex h-full w-[240px] flex-col bg-[#050505] border-r border-[#1a1a1a]">
      {/* 로고 영역 */}
      <div className="flex items-center gap-2.5 border-b border-[#1a1a1a] px-6 py-6">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-white shadow-[0_0_15px_rgba(255,255,255,0.2)]">
          <TrendingUp className="h-4 w-4 text-[#050505]" strokeWidth={3} />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-black tracking-tighter text-white uppercase">
            Stock<span className="text-neutral-500">Insight</span>
          </span>
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-600">Terminal v1.0</span>
        </div>
      </div>

      {/* 메인 네비게이션 */}
      <nav className="space-y-0.5 px-3 py-6">
        <div className="mb-2 px-3 text-[9px] font-black uppercase tracking-widest text-neutral-600">Menu</div>
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center justify-between rounded-md px-3 py-2 text-xs font-bold transition-all duration-200',
                isActive
                  ? 'bg-[#1a1a1a] text-white'
                  : 'text-neutral-500 hover:bg-[#0f0f0f] hover:text-neutral-300'
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                {label}
              </div>
              {isActive && <div className="h-1 w-1 rounded-full bg-white" />}
            </Link>
          );
        })}
      </nav>

      {/* 관심종목 섹션 (Comparison Board) */}
      <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-hide">
        <div className="mb-3 flex items-center justify-between px-3">
          <span className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Watchlist</span>
          <Link href="/watchlist" className="text-[9px] font-bold text-neutral-700 hover:text-neutral-400">View All</Link>
        </div>
        <div className="space-y-1">
          {watchlist?.slice(0, 8).map((stock) => (
            <Link
              key={stock.ticker}
              href={`/stocks/${stock.ticker}`}
              className={clsx(
                "group flex items-center justify-between rounded-md px-3 py-2 transition-colors",
                pathname === `/stocks/${stock.ticker}` ? "bg-[#111] border border-[#222]" : "hover:bg-[#0f0f0f]"
              )}
            >
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-neutral-300 group-hover:text-white transition-colors">{stock.ticker}</span>
                <span className="text-[9px] font-medium text-neutral-600 truncate w-24">{stock.name}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className={clsx(
                  "text-[10px] font-black",
                  stock.change_rate > 0 ? "text-red-500" : stock.change_rate < 0 ? "text-blue-500" : "text-neutral-500"
                )}>
                  {formatPercent(stock.change_rate)}
                </span>
                <ChevronRight size={10} className="text-neutral-800 group-hover:text-neutral-600 transition-colors" />
              </div>
            </Link>
          ))}
          {(!watchlist || watchlist.length === 0) && (
            <div className="px-3 py-4 text-center">
              <p className="text-[10px] font-medium text-neutral-700 italic">No stocks tracked</p>
            </div>
          )}
        </div>
      </div>

      {/* 푸터 영역 */}
      <div className="border-t border-[#1a1a1a] p-3 space-y-1">
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-bold text-neutral-600 transition-colors hover:bg-[#0f0f0f] hover:text-neutral-400"
        >
          <Settings size={16} />
          시스템 설정
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-bold text-neutral-700 transition-colors hover:bg-[#0f0f0f] hover:text-red-900"
        >
          <LogOut size={16} />
          로그아웃
        </button>
      </div>
    </aside>
  );
}

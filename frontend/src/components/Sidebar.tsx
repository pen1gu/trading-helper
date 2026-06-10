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
import { clsx } from 'clsx';
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
    <aside className="fixed left-0 top-0 z-40 flex h-full w-[260px] flex-col bg-white border-r border-slate-200 shadow-[4px_0_24px_rgba(15,23,42,0.02)]">
      {/* 로고 영역 */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 shadow-[0_4px_12px_rgba(79,70,229,0.3)]">
          <TrendingUp className="h-5 w-5 text-white" strokeWidth={2.5} />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-black tracking-tight text-slate-900 uppercase">
            Stock<span className="text-indigo-600">Insight</span>
          </span>
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Terminal v2.0</span>
        </div>
      </div>

      {/* 메인 네비게이션 */}
      <nav className="space-y-1.5 px-4 py-8">
        <div className="mb-4 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Main Menu</div>
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center justify-between rounded-2xl px-4 py-3.5 text-sm font-bold transition-all duration-200 group',
                isActive
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100/50 translate-x-1'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'} />
                {label}
              </div>
              {isActive && <ChevronRight size={16} className="text-indigo-400" />}
            </Link>
          );
        })}
      </nav>

      {/* 관심종목 섹션 */}
      <div className="flex-1 overflow-y-auto px-4 py-2 scrollbar-hide">
        <div className="mb-4 flex items-center justify-between px-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Watchlist</span>
          <Link href="/watchlist" className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">View All</Link>
        </div>
        <div className="space-y-1.5">
          {watchlist?.slice(0, 8).map((stock) => (
            <Link
              key={stock.ticker}
              href={`/stocks/${stock.ticker}`}
              className={clsx(
                "group flex items-center justify-between rounded-2xl px-4 py-3 transition-all border border-transparent",
                pathname === `/stocks/${stock.ticker}` 
                  ? "bg-white border-slate-200 shadow-[0_2px_8px_rgba(15,23,42,0.04)] text-slate-900" 
                  : "hover:bg-slate-50 hover:border-slate-100"
              )}
            >
              <div className="flex flex-col">
                <span className={clsx(
                  "text-xs font-black transition-colors",
                  pathname === `/stocks/${stock.ticker}` ? "text-indigo-600" : "text-slate-700 group-hover:text-indigo-600"
                )}>{stock.ticker}</span>
                <span className="text-[10px] font-medium text-slate-500 truncate w-28">{stock.name}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className={clsx(
                  "text-[11px] font-bold",
                  stock.change_rate > 0 ? "text-red-500" : stock.change_rate < 0 ? "text-blue-500" : "text-slate-400"
                )}>
                  {formatPercent(stock.change_rate)}
                </span>
              </div>
            </Link>
          ))}
          {(!watchlist || watchlist.length === 0) && (
            <div className="px-3 py-4 text-center">
              <p className="text-[10px] font-medium text-slate-400 italic">No stocks tracked</p>
            </div>
          )}
        </div>
      </div>

      {/* 푸터 영역 */}
      <div className="border-t border-slate-100 p-4 space-y-1 bg-white">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <Settings size={18} className="text-slate-400" />
          시스템 설정
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={18} className="text-red-400" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}

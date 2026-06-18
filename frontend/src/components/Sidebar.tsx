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
  ChevronLeft,
  HardDriveDownload,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatPercent } from '@/lib/format';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/watchlist', label: '관심종목', icon: Star },
  { href: '/discover', label: '종목 탐색', icon: Compass },
  { href: '/stocks/add', label: '종목 추가', icon: PlusCircle },
  { href: '/data', label: '데이터 로딩', icon: HardDriveDownload },
];

interface Stock {
  ticker: string;
  name: string;
  current_price?: number;
  change_rate: number;
}

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { data: watchlist } = useSWR<Stock[]>('/stocks', fetcher);

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 z-40 flex h-full flex-col bg-sidebar shadow-[4px_0_24px_rgba(167,139,250,0.06)] transition-all duration-300 ease-in-out border-r border-border/50",
        isCollapsed ? "w-[80px]" : "w-[260px]"
      )}
    >
      <div className={cn("flex items-center gap-3 px-6 py-8 relative", isCollapsed && "px-4 justify-center")}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#a78bfa] to-[#f472b6] shadow-[0_4px_12px_rgba(109,40,217,0.4)]">
          <TrendingUp className="h-5 w-5 text-white" strokeWidth={1.5} />
        </div>
        {!isCollapsed && (
          <div className="flex flex-col overflow-hidden animate-in fade-in duration-500">
            <span className="text-base font-semibold tracking-tight text-foreground whitespace-nowrap">
              Stock<span className="text-primary">Insight</span>
            </span>
            <span className="text-[10px] font-medium text-muted">AI 주식 리포트</span>
          </div>
        )}
        
        {/* 토글 버튼 */}
        <button
          onClick={onToggle}
          className="absolute -right-3 top-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted hover:text-primary hover:shadow-sm transition-all shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
        >
          {isCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </div>

      <nav className={cn("space-y-1.5 px-4 py-8", isCollapsed && "px-2")}>
        {!isCollapsed && <div className="mb-4 px-4 text-[11px] font-bold text-muted uppercase tracking-wider">메인 메뉴</div>}
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={isCollapsed ? label : undefined}
              className={cn(
                'flex items-center rounded-2xl transition-all duration-200 group relative',
                isCollapsed ? "justify-center h-12 w-12 mx-auto px-0" : "justify-between px-4 py-3.5",
                isActive
                  ? 'bg-sidebar-active text-primary shadow-sm'
                  : 'text-muted hover:bg-sidebar-hover hover:text-foreground'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon size={20} strokeWidth={isActive ? 2 : 1.5} className={cn("shrink-0", isActive ? 'text-primary' : 'text-muted group-hover:text-foreground')} />
                {!isCollapsed && <span className="text-sm font-bold whitespace-nowrap">{label}</span>}
              </div>
              {!isCollapsed && isActive && <ChevronRight size={14} className="text-primary/60" />}
              
              {isCollapsed && isActive && (
                <div className="absolute left-0 h-6 w-1 rounded-r-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className={cn("flex-1 overflow-y-auto px-4 py-2 scrollbar-hide", isCollapsed && "px-2")}>
        {!isCollapsed && (
          <div className="mb-4 flex items-center justify-between px-4">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">관심종목</span>
            <Link href="/watchlist" className="text-[11px] font-bold text-primary hover:underline transition-all">전체</Link>
          </div>
        )}
        <div className="space-y-2">
          {watchlist?.slice(0, 10).map((stock) => (
            <Link
              key={stock.ticker}
              href={`/stocks/${stock.ticker}`}
              title={isCollapsed ? `${stock.ticker} - ${stock.name}` : undefined}
              className={cn(
                "group flex items-center rounded-2xl transition-all",
                isCollapsed ? "justify-center h-12 w-12 mx-auto px-0" : "justify-between px-4 py-3 border border-transparent",
                pathname === `/stocks/${stock.ticker}`
                  ? "bg-card border-border shadow-[var(--shadow-soft)] text-foreground"
                  : "hover:bg-sidebar-hover"
              )}
            >
              {isCollapsed ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-[10px] font-black text-primary border border-primary/10">
                  {stock.ticker.substring(0, 2)}
                </div>
              ) : (
                <>
                  <div className="flex flex-col min-w-0">
                    <span className={cn(
                      "text-xs font-black transition-colors",
                      pathname === `/stocks/${stock.ticker}` ? "text-primary" : "text-foreground group-hover:text-primary"
                    )}>{stock.ticker}</span>
                    <span className="text-[10px] font-bold text-muted truncate w-24">{stock.name}</span>
                  </div>
                  <div className="flex flex-col items-end shrink-0 ml-1">
                    <span className={cn(
                      "text-[10px] font-black",
                      stock.change_rate > 0 ? "text-up" : stock.change_rate < 0 ? "text-down" : "text-muted"
                    )}>
                      {formatPercent(stock.change_rate)}
                    </span>
                  </div>
                </>
              )}
            </Link>
          ))}
        </div>
      </div>

      <div className={cn("p-4 space-y-2 bg-sidebar/50 backdrop-blur-sm border-t border-border/30", isCollapsed && "px-2")}>
        <Link
          href="/settings"
          title={isCollapsed ? "시스템 설정" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl transition-colors text-muted hover:text-foreground",
            isCollapsed ? "justify-center h-10 w-10 mx-auto" : "px-4 py-2.5 text-xs font-bold hover:bg-sidebar-hover"
          )}
        >
          <Settings size={18} strokeWidth={2} />
          {!isCollapsed && <span>시스템 설정</span>}
        </Link>
        <button
          type="button"
          title={isCollapsed ? "로그아웃" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl transition-colors text-up/70 hover:text-up",
            isCollapsed ? "justify-center h-10 w-10 mx-auto" : "px-4 py-2.5 text-xs font-bold hover:bg-[#fde8e8]/50"
          )}
        >
          <LogOut size={18} strokeWidth={2} />
          {!isCollapsed && <span>로그아웃</span>}
        </button>
      </div>
    </aside>
  );
}

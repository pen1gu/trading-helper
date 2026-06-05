'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Star,
  Compass,
  Newspaper,
  Settings,
  LogOut,
  TrendingUp,
} from 'lucide-react';
import { clsx } from 'clsx';

const navItems = [
  { href: '/', label: '대시보드', icon: LayoutDashboard },
  { href: '/watchlist', label: '관심종목', icon: Star },
  { href: '/discover', label: '종목 탐색', icon: Compass },
  { href: '/news', label: '뉴스 허브', icon: Newspaper },
  { href: '/settings', label: '설정', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-full w-[240px] flex-col bg-[#0a0a0a]">
      <div className="flex items-center gap-3 border-b border-[#262626] px-6 py-7">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
          <TrendingUp className="h-5 w-5 text-[#0a0a0a]" strokeWidth={2.5} />
        </div>
        <div>
          <span className="text-lg font-bold tracking-tight text-white">
            Stock<span className="text-neutral-400">Insight</span>
          </span>
          <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-500">AI Trading</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-[#262626] text-white'
                  : 'text-neutral-400 hover:bg-[#1a1a1a] hover:text-neutral-200'
              )}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[#262626] p-3">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-neutral-500 transition-colors hover:bg-[#1a1a1a] hover:text-neutral-300"
        >
          <LogOut size={20} />
          로그아웃
        </button>
      </div>
    </aside>
  );
}

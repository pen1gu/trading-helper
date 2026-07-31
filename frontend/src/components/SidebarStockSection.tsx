'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';
import { formatPercent } from '@/lib/format';

interface Stock {
  ticker: string;
  name: string;
  current_price?: number;
  change_rate: number;
}

interface SidebarStockSectionProps {
  title: string;
  viewAllHref: string;
  stocks?: Stock[];
  previewCount: number;
  isCollapsed: boolean;
  pathname: string;
  className?: string;
}

export default function SidebarStockSection({
  title,
  viewAllHref,
  stocks,
  previewCount,
  isCollapsed,
  pathname,
  className,
}: SidebarStockSectionProps) {
  const visibleStocks = stocks?.slice(0, previewCount) ?? [];

  return (
    <div className={className}>
      {!isCollapsed && (
        <div className="mb-4 flex items-center justify-between px-4">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider">{title}</span>
          <Link href={viewAllHref} className="text-[11px] font-bold text-primary hover:underline transition-all">
            전체
          </Link>
        </div>
      )}
      <div className="space-y-2">
        {visibleStocks.map((stock) => (
          <Link
            key={stock.ticker}
            href={`/stocks/${stock.ticker}`}
            title={isCollapsed ? `${stock.ticker} - ${stock.name}` : undefined}
            className={cn(
              'group flex items-center rounded-2xl transition-all',
              isCollapsed ? 'justify-center h-12 w-12 mx-auto px-0' : 'justify-between px-4 py-3 border border-transparent',
              pathname === `/stocks/${stock.ticker}`
                ? 'bg-card border-border shadow-[var(--shadow-soft)] text-foreground'
                : 'hover:bg-sidebar-hover',
            )}
          >
            {isCollapsed ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-[10px] font-black text-primary border border-primary/10">
                {stock.ticker.substring(0, 2)}
              </div>
            ) : (
              <>
                <div className="flex flex-col min-w-0">
                  <span
                    className={cn(
                      'text-xs font-black transition-colors',
                      pathname === `/stocks/${stock.ticker}` ? 'text-primary' : 'text-foreground group-hover:text-primary',
                    )}
                  >
                    {stock.ticker}
                  </span>
                  <span className="text-[10px] font-bold text-muted truncate w-24">{stock.name}</span>
                </div>
                <div className="flex flex-col items-end shrink-0 ml-1">
                  <span
                    className={cn(
                      'text-[10px] font-black',
                      stock.change_rate > 0 ? 'text-up' : stock.change_rate < 0 ? 'text-down' : 'text-muted',
                    )}
                  >
                    {formatPercent(stock.change_rate)}
                  </span>
                </div>
              </>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

'use client';

import { Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatStockPrice, formatPercent, formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';

interface StockHeaderProps {
  stock: {
    ticker: string;
    name: string;
    current_price?: number;
    change_rate: number;
    change_amount?: number;
    volume?: number;
  };
  isWatched: boolean;
  onToggleWatchlist: () => void;
}

export default function StockHeader({ stock, isWatched, onToggleWatchlist }: StockHeaderProps) {
  const isUp = stock.change_rate > 0;
  const isDown = stock.change_rate < 0;

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between bg-card/80 px-6 py-5 backdrop-blur-md shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-foreground">{stock.name}</h1>
              <span className="text-sm font-medium text-muted">{stock.ticker}</span>
              <button
                onClick={onToggleWatchlist}
                className="ml-1 transition-transform hover:scale-110 active:scale-90"
              >
                <Star
                  className={cn(
                    "h-5 w-5 transition-colors",
                    isWatched ? "fill-[#fbbf24] text-[#fbbf24]" : "text-border-dark hover:text-muted"
                  )}
                  strokeWidth={1.5}
                />
              </button>
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs font-semibold text-muted">
              <span className="rounded-lg bg-surface px-1.5 py-0.5">KOSPI</span>
              <span>장중</span>
            </div>
          </div>
        </div>

        <div className="h-10 w-[1px] bg-border" />

        <div className="flex items-center gap-8">
          <div>
            <p className="mb-1 text-[10px] font-medium text-muted">현재가</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-semibold text-foreground">
                {formatStockPrice(stock.current_price, stock.ticker)}
              </span>
              <div className={cn(
                "flex items-center gap-0.5 text-xs font-semibold",
                isUp ? "text-up" : isDown ? "text-down" : "text-muted"
              )}>
                {isUp ? <TrendingUp size={12} strokeWidth={1.5} /> : isDown ? <TrendingDown size={12} strokeWidth={1.5} /> : <Minus size={12} strokeWidth={1.5} />}
                <span>{formatPercent(stock.change_rate)}</span>
                <span className="ml-1 text-[10px] opacity-70">
                  {stock.change_amount ? `${stock.change_amount > 0 ? '+' : ''}${formatNumber(stock.change_amount)}` : ''}
                </span>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-medium text-muted">거래량</p>
            <p className="text-base font-semibold text-foreground">
              {formatNumber(stock.volume, 0)} <span className="text-[10px] font-medium text-muted">주</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-full bg-[#d1fae5] px-3 py-1 text-[10px] font-semibold text-[#047857]">
          <div className="h-1.5 w-1.5 rounded-full bg-[#10b981] animate-pulse" />
          REALTIME
        </div>
      </div>
    </div>
  );
}

'use client';

import { Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatStockPrice, formatPercent, formatNumber } from '@/lib/format';
import { clsx } from 'clsx';

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
    <div className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-200 bg-white/80 px-6 py-5 backdrop-blur-md">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-neutral-900">{stock.name}</h1>
              <span className="text-sm font-medium text-neutral-400">{stock.ticker}</span>
              <button
                onClick={onToggleWatchlist}
                className="ml-1 transition-transform hover:scale-110 active:scale-90"
              >
                <Star 
                  className={clsx(
                    "h-5 w-5 transition-colors",
                    isWatched ? "fill-yellow-400 text-yellow-400" : "text-neutral-300 hover:text-neutral-400"
                  )} 
                />
              </button>
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs font-bold text-neutral-400">
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 uppercase tracking-wider">KOSPI</span>
              <span>장중</span>
            </div>
          </div>
        </div>

        <div className="h-10 w-[1px] bg-neutral-200" />

        <div className="flex items-center gap-8">
          <div>
            <p className="mb-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">현재가</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-neutral-900">
                {formatStockPrice(stock.current_price, stock.ticker)}
              </span>
              <div className={clsx(
                "flex items-center gap-0.5 text-xs font-bold",
                isUp ? "text-red-600" : isDown ? "text-blue-600" : "text-neutral-400"
              )}>
                {isUp ? <TrendingUp size={12} /> : isDown ? <TrendingDown size={12} /> : <Minus size={12} />}
                <span>{formatPercent(stock.change_rate)}</span>
                <span className="ml-1 text-[10px] opacity-70">
                  {stock.change_amount ? `${stock.change_amount > 0 ? '+' : ''}${formatNumber(stock.change_amount)}` : ''}
                </span>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">거래량</p>
            <p className="text-base font-bold text-neutral-700">
              {formatNumber(stock.volume, 0)} <span className="text-[10px] font-medium text-neutral-400">주</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Market Status Placeholder */}
        <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-600">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          REALTIME
        </div>
      </div>
    </div>
  );
}

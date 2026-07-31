'use client';

import {
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  HardDriveDownload,
  Loader2,
  Clock,
} from 'lucide-react';
import {
  formatStockPrice,
  formatPercent,
  formatNumber,
  formatDate,
  isKoreanTicker,
  isLikelyWarrantOrNonEquity,
} from '@/lib/format';
import { cn } from '@/lib/cn';

function formatMarketLabel(market?: string | null, ticker?: string): string {
  if (market?.trim()) return market.trim();
  return isKoreanTicker(ticker) ? 'KOSPI/KOSDAQ' : 'NASDAQ/NYSE';
}

interface StockHeaderProps {
  stock: {
    ticker: string;
    name: string;
    market?: string | null;
    current_price?: number;
    change_rate: number;
    change_amount?: number;
    volume?: number;
    per?: number | null;
    roe?: number | null;
    market_cap?: number | null;
  };
  isWatched: boolean;
  onToggleWatchlist: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastCollectedAt?: string | null;
  refreshError?: string | null;
}

export default function StockHeader({
  stock,
  isWatched,
  onToggleWatchlist,
  onRefresh,
  isRefreshing,
  lastCollectedAt,
  refreshError,
}: StockHeaderProps) {
  const isUp = stock.change_rate > 0;
  const isDown = stock.change_rate < 0;
  const marketLabel = formatMarketLabel(stock.market, stock.ticker);
  const sparseMetrics =
    stock.per == null && stock.roe == null && stock.market_cap == null;
  const showNonEquityHint =
    isLikelyWarrantOrNonEquity(stock.ticker) || sparseMetrics;

  return (
    <div className="sticky top-0 z-30 flex flex-col bg-card/80 px-6 py-5 backdrop-blur-md shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between">
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
                      'h-5 w-5 transition-colors',
                      isWatched ? 'fill-[#fbbf24] text-[#fbbf24]' : 'text-border-dark hover:text-muted',
                    )}
                    strokeWidth={1.5}
                  />
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-xs font-semibold text-muted">
                <span className="rounded-lg bg-surface px-1.5 py-0.5">{marketLabel}</span>
              </div>
            </div>
          </div>

          <div className="h-10 w-[1px] bg-border" />

          <div className="flex items-center gap-8">
            <div>
              <p className="mb-1 text-[10px] font-medium text-muted">현재가</p>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-semibold tabular-nums text-foreground">
                  {formatStockPrice(stock.current_price, stock.ticker)}
                </span>
                <div
                  className={cn(
                    'flex items-center gap-0.5 text-xs font-semibold',
                    isUp ? 'text-up' : isDown ? 'text-down' : 'text-muted',
                  )}
                >
                  {isUp ? (
                    <TrendingUp size={12} strokeWidth={1.5} />
                  ) : isDown ? (
                    <TrendingDown size={12} strokeWidth={1.5} />
                  ) : (
                    <Minus size={12} strokeWidth={1.5} />
                  )}
                  <span>{formatPercent(stock.change_rate)}</span>
                  <span className="ml-1 text-[10px] opacity-70">
                    {stock.change_amount
                      ? `${stock.change_amount > 0 ? '+' : ''}${formatNumber(stock.change_amount)}`
                      : ''}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-medium text-muted">거래량</p>
              <p className="text-sm font-semibold tabular-nums text-foreground">
                {formatNumber(stock.volume, 0)}{' '}
                <span className="text-[10px] font-medium text-muted">주</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={cn(
              'flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-all',
              'bg-sidebar-active text-primary hover:bg-primary hover:text-white',
              'disabled:cursor-not-allowed disabled:opacity-70',
            )}
          >
            {isRefreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <HardDriveDownload className="h-3.5 w-3.5" strokeWidth={1.5} />
            )}
            {isRefreshing ? '갱신 중...' : '데이터 갱신'}
          </button>
          {lastCollectedAt ? (
            <div className="flex items-center gap-1 text-[10px] font-medium text-muted">
              <Clock size={10} strokeWidth={1.5} />
              <span>최근: {formatDate(lastCollectedAt, 'HH:mm:ss')}</span>
            </div>
          ) : (
            <div className="text-[10px] font-medium text-border-dark">수집 이력 없음</div>
          )}
          {refreshError && (
            <p className="text-[10px] font-medium text-down">{refreshError}</p>
          )}
        </div>
      </div>

      {showNonEquityHint && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#fffbeb] px-3 py-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#d97706]" strokeWidth={2} />
          <p className="text-[11px] font-medium text-[#b45309]">
            워런트·단위증권 등이거나 핵심 지표가 부족해 일반 주식 분석에 적합하지 않을 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}

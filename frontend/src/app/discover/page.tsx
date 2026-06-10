'use client';

import { useState, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher, apiClient } from '@/lib/api';
import { formatStockPrice, formatPercent } from '@/lib/format';
import { Loader2, Search, Star, ArrowRight, AlertCircle, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { calculateQuantScore } from '@/lib/quant';
import { cn } from '@/lib/cn';

interface Stock {
  id: number;
  ticker: string;
  name: string;
  current_price?: number;
  change_rate: number;
  ai_score?: number;
  ai_recommendation?: string;
  market_cap?: number;
  per?: number;
  pbr?: number;
  roe?: number;
  dividend_yield?: number;
  foreign_ownership?: number;
}

interface WatchlistItem {
  ticker: string;
}

export default function DiscoverPage() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('quant_score');
  const [market, setMarket] = useState('ALL');

  const queryParams = new URLSearchParams({
    sort_by: sortBy === 'quant_score' ? 'ai_score' : sortBy,
    ...(search && { q: search }),
    ...(market !== 'ALL' && { market })
  });

  const { data: stocks, error, isLoading } = useSWR<Stock[]>(`/stocks/scan?${queryParams.toString()}`, fetcher);
  const { data: watchlist } = useSWR<WatchlistItem[]>('/watchlist', fetcher);

  const watchSet = useMemo(() => new Set(watchlist?.map(w => w.ticker)), [watchlist]);

  const sortedStocks = useMemo(() => {
    if (!stocks) return [];
    const sorted = [...stocks];
    if (sortBy === 'quant_score') {
      sorted.sort((a, b) => calculateQuantScore(b) - calculateQuantScore(a));
    } else if (sortBy === 'change_rate') {
      sorted.sort((a, b) => (b.change_rate || 0) - (a.change_rate || 0));
    } else if (sortBy === 'change_rate_asc') {
      sorted.sort((a, b) => (a.change_rate || 0) - (b.change_rate || 0));
    } else if (sortBy === 'market_cap') {
      sorted.sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));
    }
    return sorted;
  }, [stocks, sortBy]);

  const toggleWatchlist = async (e: React.MouseEvent, ticker: string) => {
    e.preventDefault();
    e.stopPropagation();

    const isWatched = watchSet.has(ticker);
    try {
      if (isWatched) {
        await apiClient.delete(`/watchlist/${ticker}`);
      } else {
        await apiClient.post(`/watchlist/${ticker}`);
      }
      mutate('/watchlist');
      mutate('/stocks');
    } catch (err) {
      console.error('Failed to toggle watchlist:', err);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">퀀트 종목 탐색</h1>
          <p className="mt-2 text-muted font-medium">전 세계 유망 종목을 빌 게이츠 & 그레이엄 모델로 찾아보세요.</p>
        </div>
      </header>

      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="삼성전자, NVDA, AAPL 등 종목명이나 티커를 검색하세요..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-border bg-card py-4 pl-12 pr-4 text-base outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 shadow-[var(--shadow-soft)] text-foreground placeholder:text-muted"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none rounded-2xl border border-border bg-card py-2.5 pl-4 pr-10 text-sm font-semibold text-foreground outline-none transition-all hover:bg-sidebar-hover focus:border-primary shadow-[var(--shadow-soft)]"
            >
              <option value="quant_score">퀀트 스코어순</option>
              <option value="change_rate">상승률순</option>
              <option value="change_rate_asc">하락률순</option>
              <option value="market_cap">시가총액순</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={1.5} />
          </div>

          <div className="relative">
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="appearance-none rounded-2xl border border-border bg-card py-2.5 pl-4 pr-10 text-sm font-semibold text-foreground outline-none transition-all hover:bg-sidebar-hover focus:border-primary shadow-[var(--shadow-soft)]"
            >
              <option value="ALL">전체 시장</option>
              <option value="KR">국내 주식 (KOSPI/KOSDAQ)</option>
              <option value="US">해외 주식 (NASDAQ/NYSE)</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={1.5} />
          </div>

          <div className="ml-auto text-xs font-semibold text-muted bg-card px-3 py-1.5 rounded-xl shadow-[var(--shadow-soft)]">
            총 <span className="text-primary">{stocks?.length ?? 0}</span>개의 종목 분석 중
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-3xl bg-[#fde8e8] p-8 text-center shadow-[var(--shadow-soft)]">
          <AlertCircle className="mb-4 h-12 w-12 text-up" strokeWidth={1.5} />
          <p className="text-up font-semibold">데이터를 불러오는 중 오류가 발생했습니다.</p>
        </div>
      ) : !sortedStocks || sortedStocks.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-3xl bg-surface p-8 text-center shadow-[var(--shadow-soft)]">
          <p className="text-foreground font-semibold text-lg mb-2">수집된 데이터가 없거나 검색 결과가 없습니다.</p>
          <p className="mt-1 text-sm text-muted font-medium">
            <Link href="/data" className="font-semibold text-primary underline underline-offset-2">
              데이터 로딩 페이지
            </Link>
            에서 시세·뉴스 수집을 먼저 실행해 보세요.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedStocks.map((stock) => {
            const qScore = calculateQuantScore(stock);
            return (
              <div key={stock.id} className="group relative flex flex-col rounded-3xl bg-card p-6 shadow-[var(--shadow-soft)] transition-all hover:shadow-[var(--shadow-card)] hover:-translate-y-0.5">
                <button
                  onClick={(e) => toggleWatchlist(e, stock.ticker)}
                  className="absolute right-4 top-4 z-10 rounded-full bg-surface p-2 transition-transform hover:scale-110 active:scale-90"
                >
                  <Star
                    className={cn(
                      'h-6 w-6 transition-colors',
                      watchSet.has(stock.ticker)
                        ? 'fill-[#fbbf24] text-[#fbbf24]'
                        : 'text-border-dark hover:text-muted'
                    )}
                    strokeWidth={1.5}
                  />
                </button>

                <div className="mb-4 flex items-start justify-between pr-8">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground truncate max-w-[150px]">{stock.name}</h3>
                    <span className="text-xs font-medium text-muted">{stock.ticker}</span>
                  </div>
                </div>

                <div className="mb-6 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-muted">현재가</p>
                    <p className="text-2xl font-semibold text-foreground tracking-tight">{formatStockPrice(stock.current_price, stock.ticker)}</p>
                  </div>
                  <div className={cn(
                    'text-right font-semibold',
                    stock.change_rate > 0 ? 'text-up' : stock.change_rate < 0 ? 'text-down' : 'text-muted'
                  )}>
                    {formatPercent(stock.change_rate)}
                  </div>
                </div>

                <div className="mb-6 flex items-center justify-between rounded-2xl bg-surface p-3 shadow-[var(--shadow-soft)]">
                  <div className="text-center">
                    <p className="text-[10px] font-medium text-muted">퀀트 스코어</p>
                    <p className="text-base font-semibold text-foreground">{qScore}</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div className="text-center">
                    <p className="text-[10px] font-medium text-muted">상태</p>
                    <p className={cn(
                      'text-sm font-semibold mt-0.5 px-2 py-0.5 rounded-lg',
                      stock.ai_recommendation === 'Long' ? 'bg-[#fde8e8] text-up' :
                      stock.ai_recommendation === 'Short' ? 'bg-[#e0f2fe] text-down' : 'bg-surface text-muted'
                    )}>
                      {stock.ai_recommendation || 'Neutral'}
                    </p>
                  </div>
                </div>

                <Link
                  href={`/stocks/${stock.ticker}`}
                  className="btn-primary mt-auto flex items-center justify-center rounded-xl py-3 text-sm transition-all"
                >
                  상세 분석 Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.5} />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

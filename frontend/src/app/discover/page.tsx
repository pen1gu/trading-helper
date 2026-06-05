'use client';

import { useState, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher, apiClient } from '@/lib/api';
import { formatStockPrice, formatPercent } from '@/lib/format';
import { Loader2, Search, Star, ArrowRight, AlertCircle, ChevronDown } from 'lucide-react';
import Link from 'next/link';

interface Stock {
  id: number;
  ticker: string;
  name: string;
  current_price?: number;
  change_rate: number;
  ai_score?: number;
  ai_recommendation?: string;
  market_cap?: number;
}

interface WatchlistItem {
  ticker: string;
}

export default function DiscoverPage() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('ai_score');
  const [market, setMarket] = useState('ALL');
  
  const queryParams = new URLSearchParams({
    sort_by: sortBy,
    ...(search && { q: search }),
    ...(market !== 'ALL' && { market })
  });
  
  const { data: stocks, error, isLoading } = useSWR<Stock[]>(`/stocks/scan?${queryParams.toString()}`, fetcher);
  const { data: watchlist } = useSWR<WatchlistItem[]>('/watchlist', fetcher);

  const watchSet = useMemo(() => new Set(watchlist?.map(w => w.ticker)), [watchlist]);

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
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">AI 종목 탐색</h1>
          <p className="mt-2 text-neutral-500">전 세계 유망 종목을 AI 스코어와 펀더멘털 분석으로 찾아보세요.</p>
        </div>
      </header>

      {/* 검색 및 필터 섹션 (단일 검색바 통합) */}
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="삼성전자, NVDA, AAPL 등 종목명이나 티커를 검색하세요..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-neutral-200 bg-white py-4 pl-12 pr-4 text-base outline-none transition-all focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 shadow-sm"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none rounded-xl border border-neutral-200 bg-white py-2.5 pl-4 pr-10 text-sm font-semibold text-neutral-700 outline-none transition-all hover:bg-neutral-50 focus:border-neutral-900"
            >
              <option value="ai_score">AI 스코어순</option>
              <option value="change_rate">상승률순</option>
              <option value="change_rate_asc">하락률순</option>
              <option value="market_cap">시가총액순</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          </div>

          <div className="relative">
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="appearance-none rounded-xl border border-neutral-200 bg-white py-2.5 pl-4 pr-10 text-sm font-semibold text-neutral-700 outline-none transition-all hover:bg-neutral-50 focus:border-neutral-900"
            >
              <option value="ALL">전체 시장</option>
              <option value="KR">국내 주식 (KOSPI/KOSDAQ)</option>
              <option value="US">해외 주식 (NASDAQ/NYSE)</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          </div>
          
          <div className="ml-auto text-xs font-medium text-neutral-400">
            총 {stocks?.length ?? 0}개의 종목 분석 중
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-neutral-900" />
        </div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
          <AlertCircle className="mb-4 h-12 w-12 text-neutral-400" />
          <p className="text-neutral-600">데이터를 불러오는 중 오류가 발생했습니다.</p>
        </div>
      ) : !stocks || stocks.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
          <p className="text-neutral-400 font-medium">수집된 데이터가 없거나 검색 결과가 없습니다.</p>
          <p className="mt-1 text-sm text-neutral-400">홈 화면의 「데이터 불러오기」를 먼저 실행해 보세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {stocks.map((stock) => (
            <div key={stock.id} className="group relative flex flex-col rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm transition-all hover:border-neutral-900 hover:shadow-lg">
              <button
                onClick={(e) => toggleWatchlist(e, stock.ticker)}
                className="absolute right-4 top-4 z-10 rounded-full bg-neutral-50 p-2 transition-transform hover:scale-110 active:scale-90"
              >
                <Star 
                  className={`h-6 w-6 transition-colors ${
                    watchSet.has(stock.ticker) 
                      ? 'fill-yellow-400 text-yellow-400' 
                      : 'text-neutral-200 hover:text-neutral-400'
                  }`} 
                />
              </button>

              <div className="mb-4 flex items-start justify-between pr-8">
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 truncate max-w-[150px]">{stock.name}</h3>
                  <span className="text-xs font-semibold text-neutral-400">{stock.ticker}</span>
                </div>
              </div>

              <div className="mb-6 flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Current Price</p>
                  <p className="text-xl font-black text-neutral-900">{formatStockPrice(stock.current_price, stock.ticker)}</p>
                </div>
                <div className={`text-right font-black ${stock.change_rate > 0 ? 'text-red-600' : stock.change_rate < 0 ? 'text-blue-600' : 'text-neutral-400'}`}>
                  {formatPercent(stock.change_rate)}
                </div>
              </div>

              <div className="mb-6 flex items-center justify-between rounded-2xl bg-neutral-50 p-3">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">AI Score</p>
                  <p className="text-sm font-black text-neutral-900">{stock.ai_score ?? '-'}</p>
                </div>
                <div className="h-6 w-[1px] bg-neutral-200" />
                <div className="text-center">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">Status</p>
                  <p className={`text-sm font-black ${
                    stock.ai_recommendation === 'Long' ? 'text-red-600' : 
                    stock.ai_recommendation === 'Short' ? 'text-blue-600' : 'text-neutral-600'
                  }`}>
                    {stock.ai_recommendation || 'Neutral'}
                  </p>
                </div>
              </div>

              <Link
                href={`/stocks/${stock.ticker}`}
                className="mt-auto flex items-center justify-center rounded-2xl bg-neutral-900 py-3.5 text-sm font-black text-white shadow-sm transition-all hover:bg-neutral-800 hover:translate-y-[-2px] active:translate-y-0"
              >
                상세 분석 대시보드
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

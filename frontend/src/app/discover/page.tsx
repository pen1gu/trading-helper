'use client';

import { useState, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher, apiClient } from '@/lib/api';
import { formatStockPrice, formatPercent } from '@/lib/format';
import { Loader2, Search, Star, ArrowRight, AlertCircle, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { calculateQuantScore } from '@/lib/quant';

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
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">퀀트 종목 탐색</h1>
          <p className="mt-2 text-slate-500 font-medium">전 세계 유망 종목을 빌 게이츠 & 그레이엄 모델로 찾아보세요.</p>
        </div>
      </header>

      {/* 검색 및 필터 섹션 (단일 검색바 통합) */}
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="삼성전자, NVDA, AAPL 등 종목명이나 티커를 검색하세요..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-base outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-[0_2px_12px_rgba(15,23,42,0.03)] text-slate-900 placeholder:text-slate-400"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none rounded-2xl border border-slate-200 bg-white py-2.5 pl-4 pr-10 text-sm font-semibold text-slate-700 outline-none transition-all hover:bg-slate-50 focus:border-indigo-500 shadow-sm"
            >
              <option value="quant_score">퀀트 스코어순</option>
              <option value="change_rate">상승률순</option>
              <option value="change_rate_asc">하락률순</option>
              <option value="market_cap">시가총액순</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>

          <div className="relative">
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="appearance-none rounded-2xl border border-slate-200 bg-white py-2.5 pl-4 pr-10 text-sm font-semibold text-slate-700 outline-none transition-all hover:bg-slate-50 focus:border-indigo-500 shadow-sm"
            >
              <option value="ALL">전체 시장</option>
              <option value="KR">국내 주식 (KOSPI/KOSDAQ)</option>
              <option value="US">해외 주식 (NASDAQ/NYSE)</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          
          <div className="ml-auto text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
            총 <span className="text-indigo-600">{stocks?.length ?? 0}</span>개의 종목 분석 중
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        </div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-[24px] border border-dashed border-red-200 bg-red-50 p-8 text-center">
          <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
          <p className="text-red-700 font-bold">데이터를 불러오는 중 오류가 발생했습니다.</p>
        </div>
      ) : !sortedStocks || sortedStocks.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <p className="text-slate-700 font-bold text-lg mb-2">수집된 데이터가 없거나 검색 결과가 없습니다.</p>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            <Link href="/data" className="font-bold text-indigo-600 underline underline-offset-2">
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
              <div key={stock.id} className="group relative flex flex-col rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.04)] transition-all hover:border-indigo-200 hover:shadow-[0_8px_32px_-4px_rgba(79,70,229,0.1)] hover:-translate-y-1">
                <button
                  onClick={(e) => toggleWatchlist(e, stock.ticker)}
                  className="absolute right-4 top-4 z-10 rounded-full bg-slate-50 p-2 transition-transform hover:scale-110 active:scale-90"
                >
                  <Star 
                    className={`h-6 w-6 transition-colors ${
                      watchSet.has(stock.ticker) 
                        ? 'fill-yellow-400 text-yellow-400 drop-shadow-sm' 
                        : 'text-slate-300 hover:text-slate-400'
                    }`} 
                  />
                </button>

                <div className="mb-4 flex items-start justify-between pr-8">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 truncate max-w-[150px]">{stock.name}</h3>
                    <span className="text-xs font-bold text-slate-400">{stock.ticker}</span>
                  </div>
                </div>

                <div className="mb-6 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Price</p>
                    <p className="text-2xl font-black text-slate-900 tracking-tight">{formatStockPrice(stock.current_price, stock.ticker)}</p>
                  </div>
                  <div className={`text-right font-black ${stock.change_rate > 0 ? 'text-red-500' : stock.change_rate < 0 ? 'text-blue-500' : 'text-slate-500'}`}>
                    {formatPercent(stock.change_rate)}
                  </div>
                </div>

                <div className="mb-6 flex items-center justify-between rounded-2xl bg-slate-50/50 border border-slate-100 p-3">
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quant Score</p>
                    <p className="text-base font-black text-slate-900">{qScore}</p>
                  </div>
                  <div className="h-8 w-px bg-slate-200" />
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</p>
                    <p className={`text-sm font-black mt-0.5 px-2 py-0.5 rounded-md ${
                      stock.ai_recommendation === 'Long' ? 'bg-red-50 text-red-600' : 
                      stock.ai_recommendation === 'Short' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {stock.ai_recommendation || 'Neutral'}
                    </p>
                  </div>
                </div>

                <Link
                  href={`/stocks/${stock.ticker}`}
                  className="btn-primary mt-auto flex items-center justify-center rounded-xl py-3 text-sm transition-all"
                >
                  상세 분석 Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

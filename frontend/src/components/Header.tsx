'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Search, Globe, Command, Loader2 } from 'lucide-react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import Link from 'next/link';

interface StockSuggestion {
  ticker: string;
  name: string;
}

export default function Header() {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 검색어에 따른 추천 종목 데이터 fetching
  const { data: suggestions, isLoading } = useSWR<StockSuggestion[]>(
    query.length >= 1 ? `/stocks/scan?q=${query}` : null,
    fetcher
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/stocks/${query.trim().toUpperCase()}`);
      setQuery('');
      setIsFocused(false);
    }
  };

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="mb-6 flex items-center justify-between sticky top-0 z-30 bg-background/80 backdrop-blur-md py-4">
      <div className="relative" ref={dropdownRef}>
        <form onSubmit={handleSearch} className="group relative z-50">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> : <Search className="h-4 w-4 transition-colors group-focus-within:text-indigo-500" />}
          </div>
          <input
            type="search"
            placeholder="Ticker or Company name..."
            value={query}
            onFocus={() => setIsFocused(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsFocused(true);
            }}
            className="w-80 rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-12 text-sm font-medium text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.04)] outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1 text-[9px] font-bold text-slate-400">
            <Command size={10} />
            <span>K</span>
          </div>
        </form>

        {/* 검색 제안 드롭다운 */}
        {isFocused && query.length >= 1 && (
          <div className="absolute top-full left-0 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5 z-40 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="max-h-[300px] overflow-y-auto p-1.5">
              {suggestions && suggestions.length > 0 ? (
                suggestions.slice(0, 10).map((stock) => (
                  <button
                    key={stock.ticker}
                    onClick={() => {
                      router.push(`/stocks/${stock.ticker}`);
                      setQuery('');
                      setIsFocused(false);
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-900">{stock.ticker}</span>
                      <span className="text-[10px] font-medium text-slate-500">{stock.name}</span>
                    </div>
                    <div className="rounded-lg bg-indigo-50 px-2 py-1 text-[9px] font-bold text-indigo-600 uppercase tracking-wider">
                      Stock
                    </div>
                  </button>
                ))
              ) : !isLoading ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-xs font-bold text-slate-400">검색 결과가 없습니다.</p>
                </div>
              ) : null}
            </div>
            <div className="border-t border-slate-100 bg-slate-50 px-3 py-2.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Press Enter to search directly</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-2xl bg-white border border-slate-200 px-4 py-2 shadow-sm">
          <Globe size={14} className="text-indigo-500" />
          <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">KOSPI 2,542.1</span>
          <span className="text-[10px] font-bold text-red-500">+0.45%</span>
        </div>

        <div className="h-6 w-[1px] bg-slate-200 mx-1" />

        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-sm"
        >
          <Bell size={18} className="text-slate-600" />
          <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white" />
        </button>
        
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-xs font-black text-white shadow-lg shadow-indigo-200">
          U
        </div>
      </div>
    </header>
  );
}

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
    <header className="mb-6 flex items-center justify-between">
      <div className="relative" ref={dropdownRef}>
        <form onSubmit={handleSearch} className="group relative z-50">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-neutral-400">
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
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
            className="w-80 rounded-lg border border-neutral-200 bg-white/50 py-2 pl-9 pr-12 text-xs font-medium text-neutral-900 shadow-sm outline-none transition-all placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:ring-4 focus:ring-neutral-900/5"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded border border-neutral-200 bg-neutral-50 px-1 py-0.5 text-[8px] font-black text-neutral-400">
            <Command size={8} />
            <span>K</span>
          </div>
        </form>

        {/* 검색 제안 드롭다운 */}
        {isFocused && query.length >= 1 && (
          <div className="absolute top-full left-0 mt-2 w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl z-40 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="max-h-[300px] overflow-y-auto p-1">
              {suggestions && suggestions.length > 0 ? (
                suggestions.slice(0, 10).map((stock) => (
                  <button
                    key={stock.ticker}
                    onClick={() => {
                      router.push(`/stocks/${stock.ticker}`);
                      setQuery('');
                      setIsFocused(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-neutral-50"
                  >
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black text-neutral-900">{stock.ticker}</span>
                      <span className="text-[10px] font-medium text-neutral-500">{stock.name}</span>
                    </div>
                    <div className="rounded bg-neutral-100 px-1.5 py-0.5 text-[8px] font-bold text-neutral-400 uppercase">
                      Stock
                    </div>
                  </button>
                ))
              ) : !isLoading ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-[10px] font-bold text-neutral-400">검색 결과가 없습니다.</p>
                </div>
              ) : null}
            </div>
            <div className="border-t border-neutral-100 bg-neutral-50 px-3 py-2">
              <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest text-center">Press Enter to search directly</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5">
          <Globe size={12} className="text-neutral-400" />
          <span className="text-[10px] font-black text-neutral-600 uppercase tracking-tight">KOSPI 2,542.1</span>
          <span className="text-[9px] font-bold text-red-600">+0.45%</span>
        </div>

        <div className="h-4 w-[1px] bg-neutral-200 mx-1" />

        <button
          type="button"
          className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white transition-all hover:border-neutral-900 hover:shadow-sm"
        >
          <Bell size={14} className="text-neutral-600" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-neutral-900 border-2 border-white" />
        </button>
        
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-[10px] font-black text-white shadow-lg shadow-neutral-200">
          U
        </div>
      </div>
    </header>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Search, Globe, Command, Loader2 } from 'lucide-react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';

interface StockSuggestion {
  ticker: string;
  name: string;
}

export default function Header() {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    <header className="mb-6 flex items-center justify-between sticky top-0 z-30 glass-panel py-4 -mx-2 px-2 rounded-2xl">
      <div className="relative" ref={dropdownRef}>
        <form onSubmit={handleSearch} className="group relative z-50">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-muted">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Search className="h-4 w-4 transition-colors group-focus-within:text-primary" strokeWidth={1.5} />}
          </div>
          <input
            type="search"
            placeholder="티커 또는 종목명 검색..."
            value={query}
            onFocus={() => setIsFocused(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsFocused(true);
            }}
            className="w-80 rounded-full border border-border bg-card py-2.5 pl-11 pr-12 text-sm font-medium text-foreground shadow-[var(--shadow-soft)] outline-none transition-all placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded-lg border border-border bg-surface px-1.5 py-1 text-[9px] font-semibold text-muted">
            <Command size={10} />
            <span>K</span>
          </div>
        </form>

        {isFocused && query.length >= 1 && (
          <div className="absolute top-full left-0 mt-2 w-full overflow-hidden rounded-2xl bg-card shadow-xl z-40">
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
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-sidebar-hover"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-foreground">{stock.ticker}</span>
                      <span className="text-[10px] font-medium text-muted">{stock.name}</span>
                    </div>
                    <div className="rounded-lg bg-sidebar-active px-2 py-1 text-[9px] font-semibold text-primary">
                      종목
                    </div>
                  </button>
                ))
              ) : !isLoading ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-xs font-medium text-muted">검색 결과가 없습니다.</p>
                </div>
              ) : null}
            </div>
            <div className="bg-surface px-3 py-2.5">
              <p className="text-[10px] font-medium text-muted text-center">Enter로 직접 검색</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-full bg-card px-4 py-2 shadow-[var(--shadow-soft)]">
          <Globe size={14} className="text-primary" strokeWidth={1.5} />
          <span className="text-[11px] font-semibold text-foreground">KOSPI 2,542.1</span>
          <span className="text-[10px] font-semibold text-up">+0.45%</span>
        </div>

        <div className="h-6 w-[1px] bg-border mx-1" />

        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-card shadow-[var(--shadow-soft)] transition-all hover:shadow-[var(--shadow-card)]"
        >
          <Bell size={18} className="text-muted" strokeWidth={1.5} />
          <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-up border-2 border-card" />
        </button>

        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] text-xs font-semibold text-white shadow-[0_4px_12px_rgba(109,40,217,0.45)]">
          U
        </div>
      </div>
    </header>
  );
}

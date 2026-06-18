'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, PlusCircle, CheckCircle2, TrendingUp, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/cn';

interface PreviewStock {
  ticker: string;
  name: string;
  current_price?: number;
  change_rate?: number;
  is_crawling_target: boolean;
}

export default function AddStockPage() {
  const [ticker, setTicker] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [previewStock, setPreviewStock] = useState<PreviewStock | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  const router = useRouter();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) return;

    setIsSearching(true);
    setError(null);
    setPreviewStock(null);

    try {
      // get_stock API는 DB에 없으면 외부에서 가져와서 DB에 저장 후 반환함
      const res = await apiClient.get(`/stocks/${ticker.toUpperCase().trim()}`);
      setPreviewStock(res.data);
    } catch (err: any) {
      console.error(err);
      setError('종목을 찾을 수 없습니다. 티커(Ticker)를 확인해주세요.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddTarget = async () => {
    if (!previewStock) return;
    setIsAdding(true);
    
    try {
      const res = await apiClient.post(`/stocks/${previewStock.ticker}/target`);
      setPreviewStock(res.data);
    } catch (err) {
      console.error(err);
      setError('크롤링 대상 추가에 실패했습니다.');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <p className="text-sm font-medium text-muted mb-1">데이터 관리</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">수동 종목 추가</h1>
        <p className="text-sm text-muted mt-2">
          찾으시는 종목이 목록에 없나요? 티커(예: AAPL, 005930)를 검색하여 크롤링 대상에 추가하면 매일 자동으로 데이터를 수집하고 분석합니다.
        </p>
      </div>

      <div className="card-modern p-8">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" strokeWidth={1.5} />
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="종목 티커 입력 (예: TSLA, 035420)"
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-surface border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground font-semibold placeholder:text-muted/60 transition-all"
            />
          </div>
          <button 
            type="submit" 
            disabled={isSearching || !ticker.trim()}
            className="btn-primary px-8 rounded-2xl font-bold flex items-center gap-2 disabled:opacity-50"
          >
            {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : '검색'}
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 rounded-xl bg-[#fde8e8] border border-[#fca5a5] flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-up" />
            <p className="text-sm font-semibold text-up">{error}</p>
          </div>
        )}

        {previewStock && (
          <div className="mt-8 pt-8 border-t border-border/50 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-sm font-bold text-muted mb-4 uppercase tracking-wider">검색 결과</h3>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-3xl bg-surface/50 border-2 border-primary/10 shadow-[var(--shadow-soft)]">
              
              <div className="flex items-center gap-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#a78bfa] to-[#f472b6] shadow-sm">
                  <TrendingUp className="h-7 w-7 text-white" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <h2 className="text-2xl font-black text-foreground tracking-tight">{previewStock.ticker}</h2>
                    <span className="text-sm font-bold text-muted truncate max-w-[200px]">{previewStock.name}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-black text-foreground">
                      {formatNumber(previewStock.current_price)}
                    </span>
                    {previewStock.change_rate != null && (
                      <span className={cn(
                        "text-xs font-bold px-2 py-0.5 rounded-md",
                        previewStock.change_rate > 0 ? "bg-[#fde8e8] text-up" : "bg-[#e0f2fe] text-down"
                      )}>
                        {previewStock.change_rate > 0 ? '+' : ''}{formatPercent(previewStock.change_rate)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-3">
                {previewStock.is_crawling_target ? (
                  <div className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#d1fae5] border-2 border-[#10b981]/20 text-[#047857] font-bold">
                    <CheckCircle2 className="h-5 w-5" />
                    이미 크롤링 대상입니다
                  </div>
                ) : (
                  <button 
                    onClick={handleAddTarget}
                    disabled={isAdding}
                    className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-foreground text-background font-bold hover:bg-primary hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50"
                  >
                    {isAdding ? <Loader2 className="h-5 w-5 animate-spin" /> : <PlusCircle className="h-5 w-5" />}
                    매일 크롤링 대상에 추가
                  </button>
                )}
                
                <button
                  onClick={() => router.push(`/stocks/${previewStock.ticker}`)}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  상세 페이지로 이동하기
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

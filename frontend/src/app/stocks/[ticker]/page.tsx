'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { fetcher, apiClient } from '@/lib/api';
import { formatStockPrice, formatPercent, formatNumber } from '@/lib/format';
import { 
  Loader2, 
  ArrowLeft, 
  Target, 
  Info, 
  Newspaper,
  ShieldCheck,
  Zap,
  CheckCircle2,
  XCircle,
  Star,
  AlertCircle,
  Calendar
} from 'lucide-react';
import Link from 'next/link';
import CandleChart from '@/components/CandleChart';
import RadarChartComponent from '@/components/RadarChart';
import NewsCard from '@/components/NewsCard';

interface FairPriceRange {
  min: number;
  max: number;
  reason: string;
}

interface AIAnalysis {
  hot_reason?: string;
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  radar_chart?: {
    profitability: number;
    growth: number;
    valuation: number;
    stability: number;
    momentum: number;
  };
  fair_price_range?: FairPriceRange;
}

interface Stock {
  ticker: string;
  name: string;
  current_price?: number;
  change_rate: number;
  market_cap?: number;
  per?: number;
  pbr?: number;
  roe?: number;
  dividend_yield?: number;
  foreign_ownership?: number;
  ai_score?: number;
  ai_recommendation?: string;
  ai_analysis?: AIAnalysis;
}

interface News {
  id: number;
  title: string;
  url: string;
  source: string;
  published_at: string;
  summary?: string;
}

interface WatchlistItem {
  ticker: string;
}

export default function StockDetailPage() {
  const params = useParams();
  const ticker = params.ticker as string;
  const [range, setRange] = useState('60'); // 기본 60일(3개월)

  const { data: stock, error: stockError } = useSWR<Stock>(`/stocks/${ticker}`, fetcher);
  const { data: bars } = useSWR<any[]>(`/stocks/${ticker}/bars?limit=${range}`, fetcher);
  const { data: news } = useSWR<News[]>(`/news/stock/${ticker}`, fetcher);
  const { data: watchlist } = useSWR<WatchlistItem[]>('/watchlist', fetcher);

  const isWatched = watchlist?.some(w => w.ticker === ticker);

  const toggleWatchlist = async () => {
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

  if (!stock && !stockError) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-neutral-900" />
      </div>
    );
  }

  if (stockError || !stock) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center space-y-4">
        <XCircle className="h-16 w-16 text-neutral-300" />
        <p className="text-neutral-500">종목 정보를 찾을 수 없습니다.</p>
        <Link href="/discover" className="rounded-xl bg-neutral-900 px-6 py-2 text-sm font-bold text-white">
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const fairPrice = stock.ai_analysis?.fair_price_range;
  const currentPrice = stock.current_price ?? 0;
  
  const getPricePosition = () => {
    if (!fairPrice) return 50;
    const { min, max } = fairPrice;
    if (currentPrice <= min) return 0;
    if (currentPrice >= max) return 100;
    return ((currentPrice - min) / (max - min)) * 100;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12">
      {/* 상단 헤더 */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/discover" className="rounded-full border border-neutral-200 p-2 transition-colors hover:bg-neutral-50">
            <ArrowLeft className="h-5 w-5 text-neutral-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-neutral-900">{stock.name}</h1>
              <span className="text-lg font-medium text-neutral-400">{stock.ticker}</span>
              <button
                onClick={toggleWatchlist}
                className="ml-2 p-1 transition-transform hover:scale-110 active:scale-90"
              >
                <Star 
                  className={`h-7 w-7 transition-colors ${
                    isWatched 
                      ? 'fill-yellow-400 text-yellow-400' 
                      : 'text-neutral-200 hover:text-neutral-400'
                  }`} 
                />
              </button>
            </div>
            <div className="mt-1 flex items-center gap-3">
              <span className="text-2xl font-bold text-neutral-900">{formatStockPrice(stock.current_price, stock.ticker)}</span>
              <span className={`text-lg font-bold ${stock.change_rate > 0 ? 'text-red-600' : stock.change_rate < 0 ? 'text-blue-600' : 'text-neutral-400'}`}>
                {formatPercent(stock.change_rate)}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-tighter">AI Recommendation</span>
            <span className={`text-xl font-black ${
              stock.ai_recommendation === 'Long' ? 'text-red-600' : 
              stock.ai_recommendation === 'Short' ? 'text-blue-600' : 'text-neutral-600'
            }`}>
              {stock.ai_recommendation?.toUpperCase() || 'NEUTRAL'}
            </span>
          </div>
          <div className="h-12 w-[1px] bg-neutral-200" />
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-900 text-lg font-black text-white shadow-lg shadow-neutral-200">
            {stock.ai_score ?? '-'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* 왼쪽: 차트 및 데이터 */}
        <div className="space-y-8 lg:col-span-2">
          {/* 전문 캔들 차트 */}
          <div className="card-modern p-6">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">기술적 분석</h2>
                <p className="text-xs font-medium text-neutral-400">시가·고가·저가·종가 및 20일 이동평균선</p>
              </div>
              
              <div className="flex items-center gap-1 rounded-xl bg-neutral-100 p-1">
                {[
                  { label: '1개월', value: '20' },
                  { label: '3개월', value: '60' },
                  { label: '6개월', value: '120' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setRange(opt.value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                      range === opt.value
                        ? 'bg-white text-neutral-900 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {bars ? (
              <CandleChart data={bars} />
            ) : (
              <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-neutral-200" />
              </div>
            )}
          </div>

          {/* 재무 지표 그리드 */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: '시가총액', value: formatNumber(stock.market_cap, 0), unit: '억' },
              { label: 'PER', value: formatNumber(stock.per), unit: '배' },
              { label: 'PBR', value: formatNumber(stock.pbr), unit: '배' },
              { label: 'ROE', value: formatPercent(stock.roe), unit: '' },
              { label: '배당수익률', value: formatPercent(stock.dividend_yield), unit: '' },
              { label: '외인비중', value: formatPercent(stock.foreign_ownership), unit: '' },
            ].map((item, idx) => (
              <div key={idx} className="card-modern p-4 transition-transform hover:translate-y-[-2px]">
                <p className="mb-1 text-xs font-bold text-neutral-400 uppercase tracking-wider">{item.label}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-neutral-900">{item.value}</span>
                  <span className="text-[10px] font-bold text-neutral-400">{item.unit}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 뉴스 섹션 */}
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-neutral-900">
              <Newspaper className="h-5 w-5" /> 종목 관련 최신 뉴스
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {news?.slice(0, 4).map((n) => (
                <NewsCard key={n.id} news={n} />
              ))}
              {(!news || news.length === 0) && (
                <div className="col-span-2 rounded-3xl border border-dashed border-neutral-200 p-12 text-center text-neutral-400">
                  관련 뉴스가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 오른쪽: AI 분석 대시보드 */}
        <div className="space-y-8">
          {/* AI 적정가 범위 카드 */}
          <div className="card-modern bg-neutral-900 p-6 text-white shadow-xl shadow-neutral-200">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Target className="h-5 w-5 text-red-500" /> AI 매수 적정가
              </h2>
              <ShieldCheck className="h-6 w-6 text-neutral-600" />
            </div>
            
            {fairPrice ? (
              <div className="space-y-6">
                <div className="flex justify-between text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">
                  <span>Underpriced</span>
                  <span>Overpriced</span>
                </div>
                <div className="relative h-2.5 w-full rounded-full bg-neutral-800">
                  <div 
                    className="absolute top-[-4px] h-5 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] transition-all duration-1000"
                    style={{ left: `${getPricePosition()}%`, width: '6px', transform: 'translateX(-50%)' }}
                  />
                </div>
                <div className="flex justify-between text-base font-black tracking-tight">
                  <span>{formatStockPrice(fairPrice.min, stock.ticker)}</span>
                  <span>{formatStockPrice(fairPrice.max, stock.ticker)}</span>
                </div>
                <div className="rounded-2xl bg-neutral-800/50 p-4 text-xs leading-relaxed text-neutral-300 border border-neutral-800">
                  <div className="mb-2 flex items-center gap-1.5 font-bold text-white">
                    <Info className="h-3.5 w-3.5 text-neutral-500" /> AI 분석 근거
                  </div>
                  {fairPrice.reason}
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-neutral-500 font-medium">
                데이터 수집 후 AI 분석이 진행됩니다.
              </div>
            )}
          </div>

          {/* AI 분석 요약 & Radar Chart */}
          <div className="card-modern space-y-6 p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-neutral-900">
              <Zap className="h-5 w-5 text-yellow-500" /> AI 종합 진단
            </h2>
            
            {stock.ai_analysis?.radar_chart && (
              <div className="h-64 scale-110">
                <RadarChartComponent data={stock.ai_analysis.radar_chart} />
              </div>
            )}

            <div className="space-y-5 pt-4">
              <div>
                <h3 className="mb-2 text-sm font-black text-neutral-900 uppercase tracking-tight">Hot Reason</h3>
                <p className="text-sm leading-relaxed text-neutral-600">
                  {stock.ai_analysis?.hot_reason || '분석 중입니다...'}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-3">
                  <h4 className="flex items-center gap-2 text-xs font-black text-red-600 uppercase">
                    <CheckCircle2 className="h-4 w-4" /> 투자 강점
                  </h4>
                  <ul className="space-y-2">
                    {stock.ai_analysis?.strengths?.map((s, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs font-medium text-neutral-600">
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-red-600" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-3">
                  <h4 className="flex items-center gap-2 text-xs font-black text-blue-600 uppercase">
                    <AlertCircle className="h-4 w-4" /> 리스크 요인
                  </h4>
                  <ul className="space-y-2">
                    {stock.ai_analysis?.weaknesses?.map((w, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs font-medium text-neutral-600">
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-blue-600" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

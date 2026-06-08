'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { fetcher, apiClient } from '@/lib/api';
import { formatPercent, formatNumber } from '@/lib/format';
import { 
  Loader2, 
  Target, 
  Info, 
  Newspaper,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertCircle,
  XCircle,
  TrendingUp,
  Activity,
  BarChart3
} from 'lucide-react';
import Link from 'next/link';
import CandleChart from '@/components/CandleChart';
import RadarChartComponent from '@/components/RadarChart';
import NewsCard from '@/components/NewsCard';
import StockHeader from '@/components/StockHeader';
import BusinessInsightPanel, { BusinessInsight } from '@/components/BusinessInsightPanel';
import { clsx } from 'clsx';

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
  change_amount?: number;
  volume?: number;
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
  const [range, setRange] = useState('60');

  const { data: stock, error: stockError } = useSWR<Stock>(`/stocks/${ticker}`, fetcher);
  const { data: bars } = useSWR<any[]>(`/stocks/${ticker}/bars?limit=${range}`, fetcher);
  const { data: businessInsight, isLoading: insightLoading } = useSWR<BusinessInsight>(
    `/stocks/${ticker}/business-insight`,
    fetcher,
  );
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
    <div className="-m-8 flex flex-col min-h-screen bg-neutral-50/50">
      <StockHeader 
        stock={stock} 
        isWatched={!!isWatched} 
        onToggleWatchlist={toggleWatchlist} 
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-px bg-neutral-200 h-full">
        {/* 중앙 메인: 차트 및 데이터 (3컬럼) */}
        <div className="lg:col-span-3 bg-neutral-50 flex flex-col">
          {/* 차트 영역 */}
          <div className="p-6 bg-white border-b border-neutral-200">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-neutral-400" />
                <h2 className="text-sm font-bold text-neutral-900">기술적 분석 (캔들차트)</h2>
              </div>
              
              <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1">
                {[
                  { label: '1M', value: '20' },
                  { label: '3M', value: '60' },
                  { label: '6M', value: '120' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setRange(opt.value)}
                    className={`rounded-md px-3 py-1 text-[10px] font-black transition-all ${
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

            <div className="h-[450px]">
              {bars ? (
                <CandleChart data={bars} />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-neutral-200" />
                </div>
              )}
            </div>
          </div>

          {/* 하단 정보 영역: 지표 및 뉴스 */}
          <div className="p-6 space-y-8 flex-1">
            {/* 핵심 지표 그리드 */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
              {[
                { label: '시가총액', value: formatNumber(stock.market_cap, 0), unit: '억' },
                { label: 'PER', value: formatNumber(stock.per), unit: '배' },
                { label: 'PBR', value: formatNumber(stock.pbr), unit: '배' },
                { label: 'ROE', value: formatPercent(stock.roe), unit: '' },
                { label: '배당률', value: formatPercent(stock.dividend_yield), unit: '' },
                { label: '외인', value: formatPercent(stock.foreign_ownership), unit: '' },
              ].map((item, idx) => (
                <div key={idx} className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                  <p className="mb-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{item.label}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-black text-neutral-900">{item.value}</span>
                    <span className="text-[10px] font-bold text-neutral-400">{item.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* 사업·경영 분석 */}
            <BusinessInsightPanel data={businessInsight} isLoading={insightLoading} />

            {/* 뉴스 섹션 */}
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                <Newspaper className="h-4 w-4 text-neutral-400" /> 관련 최신 뉴스
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {news?.slice(0, 4).map((n) => (
                  <NewsCard key={n.id} news={n} />
                ))}
                {(!news || news.length === 0) && (
                  <div className="col-span-2 rounded-2xl border border-dashed border-neutral-200 p-8 text-center text-xs text-neutral-400 font-medium">
                    최근 7일간 관련 뉴스가 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 우측 패널: AI 인사이트 (1컬럼) */}
        <div className="bg-white border-l border-neutral-200 flex flex-col">
          <div className="p-6 border-b border-neutral-200 bg-neutral-50/50">
            <div className="flex items-center justify-between mb-6">
              <h2 className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                <Activity className="h-4 w-4 text-neutral-400" /> AI 종목 진단
              </h2>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-xs font-black text-white">
                {stock.ai_score ?? '-'}
              </div>
            </div>

            {/* AI 적정가 범위 */}
            <div className="mb-8 p-5 bg-neutral-900 rounded-2xl text-white shadow-xl shadow-neutral-200">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xs font-bold">
                  <Target className="h-3.5 w-3.5 text-red-500" /> AI 매수 적정가
                </h3>
                <ShieldCheck className="h-4 w-4 text-neutral-600" />
              </div>
              
              {fairPrice ? (
                <div className="space-y-4">
                  <div className="relative h-1.5 w-full rounded-full bg-neutral-800">
                    <div 
                      className="absolute top-[-3px] h-3 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] transition-all duration-1000"
                      style={{ left: `${getPricePosition()}%`, width: '4px', transform: 'translateX(-50%)' }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-black tracking-tighter text-neutral-400 uppercase">
                    <span>{formatNumber(fairPrice.min)}</span>
                    <span>{formatNumber(fairPrice.max)}</span>
                  </div>
                  <div className="mt-4 text-[11px] leading-relaxed text-neutral-400 bg-neutral-800/50 p-3 rounded-lg border border-neutral-800">
                    {fairPrice.reason}
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-[11px] text-neutral-500">
                  데이터 분석 진행 중...
                </div>
              )}
            </div>

            {/* Radar Chart */}
            <div className="mb-6 h-60 flex items-center justify-center">
              {stock.ai_analysis?.radar_chart ? (
                <RadarChartComponent data={stock.ai_analysis.radar_chart} />
              ) : (
                <p className="text-[11px] text-neutral-400">차트 데이터가 없습니다.</p>
              )}
            </div>

            {/* AI 의견 */}
            <div className="space-y-6">
              <div>
                <h3 className="mb-2 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Hot Reason</h3>
                <p className="text-xs leading-relaxed text-neutral-600 font-medium">
                  {stock.ai_analysis?.hot_reason || '분석된 사유가 없습니다.'}
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="flex items-center gap-1.5 text-[10px] font-black text-red-600 uppercase">
                    <CheckCircle2 className="h-3.5 w-3.5" /> 투자 강점
                  </h4>
                  <ul className="space-y-1.5">
                    {stock.ai_analysis?.strengths?.map((s, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[11px] font-medium text-neutral-600">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-600" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="flex items-center gap-1.5 text-[10px] font-black text-neutral-400 uppercase">
                    <AlertCircle className="h-3.5 w-3.5" /> 리스크 요인
                  </h4>
                  <ul className="space-y-1.5">
                    {stock.ai_analysis?.weaknesses?.map((w, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[11px] font-medium text-neutral-600">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neutral-400" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          {/* 하단 추천/의견 요약 */}
          <div className="p-6 bg-neutral-50 flex-1">
            <h3 className="mb-3 text-[10px] font-black text-neutral-400 uppercase tracking-widest">AI Recommendation</h3>
            <div className={clsx(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-black",
              stock.ai_recommendation === 'Long' ? "bg-red-50 text-red-600" :
              stock.ai_recommendation === 'Short' ? "bg-blue-50 text-blue-600" : "bg-neutral-100 text-neutral-600"
            )}>
              <TrendingUp className="h-3.5 w-3.5" />
              {stock.ai_recommendation?.toUpperCase() || 'NEUTRAL'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

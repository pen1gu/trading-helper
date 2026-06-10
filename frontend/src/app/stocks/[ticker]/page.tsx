'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { fetcher, apiClient } from '@/lib/api';
import { formatPercent, formatNumber, formatRatioPercent, formatMarketCapEok } from '@/lib/format';
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
import { calculateQuantScore, getQuantGrade } from '@/lib/quant';

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
  business_insight?: BusinessInsight & {
    deep_value?: { ncav?: number };
  };
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
  const ncav =
    businessInsight?.deep_value?.ncav ??
    stock?.business_insight?.deep_value?.ncav;
  const { data: news } = useSWR<News[]>(`/news/stock/${ticker}`, fetcher);
  const { data: watchlist } = useSWR<WatchlistItem[]>('/watchlist', fetcher);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      await apiClient.post(`/stocks/${ticker}/analyze`);
      mutate(`/stocks/${ticker}`);
    } catch (err) {
      console.error('Analysis failed:', err);
      alert('AI 분석에 실패했습니다.');
    } finally {
      setIsAnalyzing(false);
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

  const quantScore = calculateQuantScore(stock);
  const quantGrade = getQuantGrade(quantScore);

  return (
    <div className="flex flex-col rounded-[32px] overflow-hidden border border-slate-200 bg-neutral-50/50 shadow-[0_8px_32px_-4px_rgba(15,23,42,0.04)] min-h-[calc(100vh-140px)]">
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
                <BarChart3 className="h-5 w-5 text-sky-400" />
                <h2 className="text-sm font-bold text-neutral-900">기술적 분석 (캔들차트)</h2>
              </div>
              
              <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1">
                {[
                  { label: '1W', value: '5' },
                  { label: '1M', value: '20' },
                  { label: '3M', value: '60' },
                  { label: '6M', value: '120' },
                  { label: '1Y', value: '250' },
                  { label: '5Y', value: '1250' },
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-7">
              {[
                { label: '시가총액', value: formatMarketCapEok(stock.market_cap, ticker), unit: '억' },
                { label: 'NCAV', value: ncav != null ? formatNumber(ncav / 100000000, 0) : '-', unit: '억' },
                { label: 'PER', value: formatNumber(stock.per), unit: '배' },
                { label: 'PBR', value: formatNumber(stock.pbr), unit: '배' },
                { label: 'ROE', value: formatRatioPercent(stock.roe), unit: '' },
                { label: '배당률', value: formatRatioPercent(stock.dividend_yield), unit: '' },
                { label: '외인', value: formatRatioPercent(stock.foreign_ownership), unit: '' },
              ].map((item, idx) => (
                <div key={idx} className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                  <p className="mb-1 text-[10px] font-bold text-sky-400 uppercase tracking-wider">{item.label}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-black text-neutral-900">{item.value}</span>
                    <span className="text-[10px] font-bold text-sky-400">{item.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* 사업·경영 분석 */}
            <BusinessInsightPanel data={businessInsight} isLoading={insightLoading} />

            {/* 뉴스 섹션 */}
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                <Newspaper className="h-4 w-4 text-sky-400" /> 관련 최신 뉴스
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {news?.slice(0, 4).map((n) => (
                  <NewsCard key={n.id} news={n} />
                ))}
                {(!news || news.length === 0) && (
                  <div className="col-span-2 rounded-2xl border border-dashed border-neutral-200 p-8 text-center text-xs text-sky-400 font-medium">
                    최근 7일간 관련 뉴스가 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 우측 패널: 퀀트 인사이트 (1컬럼) */}
        <div className="bg-white border-l border-neutral-200 flex flex-col">
          <div className="p-6 border-b border-neutral-200 bg-neutral-900 text-white">
            <div className="flex items-center justify-between mb-6">
              <h2 className="flex items-center gap-2 text-sm font-bold text-sky-400">
                <Activity className="h-4 w-4" /> 퀀트 종목 진단
              </h2>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg font-black text-neutral-900 shadow-lg shadow-sky-500/20">
                {quantScore}
              </div>
            </div>

            <div className="mb-2">
              <p className={clsx("text-sm font-black", quantGrade.color)}>{quantGrade.label}</p>
              <p className="text-[11px] text-neutral-400 mt-1">빌 게이츠(Quality) & 그레이엄(Value) 통합 모델</p>
            </div>
          </div>

          <div className="p-6 flex-1 space-y-8 overflow-y-auto">
            {!stock.ai_analysis ? (
              <div className="flex flex-col items-center justify-center h-full space-y-6 py-20">
                <div className="rounded-full bg-sky-50 p-4">
                  <Zap className="h-8 w-8 text-sky-400" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm font-bold text-neutral-900">AI 심층 분석이 필요합니다</p>
                  <p className="text-xs text-neutral-500 max-w-[200px] mx-auto leading-relaxed">
                    최신 뉴스, 재무 데이터, 기술적 지표를 종합하여 적정 주가와 투자 포인트를 도출합니다.
                  </p>
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="btn-primary flex items-center justify-center gap-2 px-6 py-3 text-xs shadow-lg shadow-sky-500/20 disabled:opacity-60 w-full max-w-[220px]"
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Activity className="h-4 w-4" />
                  )}
                  {isAnalyzing ? '분석 진행 중...' : 'AI 진단 요청하기'}
                </button>
              </div>
            ) : (
              <>
                {/* AI 적정가 범위 (유지하되 디자인 조정) */}
                <div className="p-5 bg-neutral-50 rounded-2xl border border-neutral-200">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-xs font-bold text-neutral-900">
                      <Target className="h-3.5 w-3.5 text-red-500" /> AI 매수 적정가
                    </h3>
                    <ShieldCheck className="h-4 w-4 text-neutral-400" />
                  </div>
                  
                  {fairPrice ? (
                    <div className="space-y-4">
                      <div className="relative h-1.5 w-full rounded-full bg-neutral-200">
                        <div 
                          className="absolute top-[-3px] h-3 rounded-full bg-neutral-900 shadow-sm transition-all duration-1000"
                          style={{ left: `${getPricePosition()}%`, width: '4px', transform: 'translateX(-50%)' }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] font-black tracking-tighter text-neutral-500 uppercase">
                        <span>{formatNumber(fairPrice.min)}</span>
                        <span>{formatNumber(fairPrice.max)}</span>
                      </div>
                      <div className="mt-4 text-[11px] leading-relaxed text-neutral-600 bg-white p-3 rounded-lg border border-neutral-200">
                        {fairPrice.reason}
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center">
                      <p className="text-[11px] text-neutral-400">분석된 적정가 정보가 없습니다.</p>
                    </div>
                  )}
                </div>

                {/* Radar Chart (퀀트 분석 결과 시각화) */}
                <div className="h-60 flex items-center justify-center">
                  {stock.ai_analysis?.radar_chart ? (
                    <RadarChartComponent data={stock.ai_analysis.radar_chart} />
                  ) : (
                    <p className="text-[11px] text-neutral-400">데이터를 분석 중입니다...</p>
                  )}
                </div>

                {/* 퀀트 세부 의견 */}
                <div className="space-y-6">
                  <div>
                    <h3 className="mb-2 text-[10px] font-black text-sky-400 uppercase tracking-widest">Investment Thesis</h3>
                    <p className="text-xs leading-relaxed text-neutral-600 font-medium italic">
                      "{stock.ai_analysis?.hot_reason || '정량적 지표 기반 분석이 진행 중입니다.'}"
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="flex items-center gap-1.5 text-[10px] font-black text-red-600 uppercase">
                        <CheckCircle2 className="h-3.5 w-3.5" /> 투자 강점 (Quality)
                      </h4>
                      <ul className="space-y-1.5">
                        {stock.ai_analysis?.strengths?.map((s, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-[11px] font-medium text-neutral-600">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-600" />
                            {s}
                          </li>
                        ))}
                        {(!stock.ai_analysis?.strengths || stock.ai_analysis.strengths.length === 0) && (
                          <li className="text-[11px] text-neutral-400">분석된 강점이 없습니다.</li>
                        )}
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="flex items-center gap-1.5 text-[10px] font-black text-sky-400 uppercase">
                        <AlertCircle className="h-3.5 w-3.5" /> 리스크 요인 (Risk)
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
              </>
            )}
          </div>
          
          {/* 하단 추천/의견 요약 */}
          {stock.ai_analysis && (
            <div className="p-6 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between">
              <div>
                <h3 className="mb-3 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Overall Signal</h3>
                <div className={clsx(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-black",
                  stock.ai_recommendation === 'Long' ? "bg-red-50 text-red-600" :
                  stock.ai_recommendation === 'Short' ? "bg-blue-50 text-blue-600" : "bg-white border border-neutral-200 text-neutral-600"
                )}>
                  <TrendingUp className="h-3.5 w-3.5" />
                  {stock.ai_recommendation?.toUpperCase() || 'NEUTRAL'}
                </div>
              </div>
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="btn-primary flex items-center justify-center gap-1.5 px-4 py-2 text-[11px] shadow-sm disabled:opacity-60"
              >
                {isAnalyzing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Activity className="h-3.5 w-3.5" />
                )}
                {isAnalyzing ? '재분석 중...' : '최신 데이터로 AI 재진단'}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

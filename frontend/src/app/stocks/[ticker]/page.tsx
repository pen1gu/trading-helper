'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { fetcher, apiClient } from '@/lib/api';
import { formatPercent, formatNumber, formatRatioPercent, formatMarketCapEok } from '@/lib/format';
import {
  Loader2,
  Target,
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
import { cn } from '@/lib/cn';
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
  quant_analysis?: FairPriceRange;
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
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (stockError || !stock) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center space-y-4">
        <XCircle className="h-16 w-16 text-border-dark" strokeWidth={1.5} />
        <p className="text-muted">종목 정보를 찾을 수 없습니다.</p>
        <Link href="/discover" className="btn-primary rounded-xl px-6 py-2 text-sm">
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const fairPrice = stock.ai_analysis?.fair_price_range;
  const quantPrice = stock.quant_analysis;
  const currentPrice = stock.current_price ?? 0;

  // 전체 시각화 스케일 계산 (Gemini, 자체 모델, 현재가 중 최솟값/최댓값 기준)
  const allPrices = [
    currentPrice,
    fairPrice?.min,
    fairPrice?.max,
    quantPrice?.min,
    quantPrice?.max,
  ].filter((p): p is number => p != null && p > 0);

  const globalMin = Math.min(...allPrices) * 0.95;
  const globalMax = Math.max(...allPrices) * 1.05;

  const getPos = (val: number) => {
    return Math.max(0, Math.min(100, ((val - globalMin) / (globalMax - globalMin)) * 100));
  };

  const quantScore = calculateQuantScore(stock);
  const quantGrade = getQuantGrade(quantScore);

  return (
    <div className="flex flex-col rounded-[40px] overflow-hidden bg-surface/50 shadow-[var(--shadow-soft)] min-h-[calc(100vh-180px)]">
      <StockHeader
        stock={stock}
        isWatched={!!isWatched}
        onToggleWatchlist={toggleWatchlist}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 p-4 h-full">
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="card-modern p-6">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" strokeWidth={1.5} />
                <h2 className="text-sm font-semibold text-foreground">기술적 분석 (캔들차트)</h2>
              </div>

              <div className="flex items-center gap-1 rounded-full bg-surface p-1">
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
                    className={cn(
                      'rounded-full px-3 py-1 text-[10px] font-semibold transition-all',
                      range === opt.value
                        ? 'bg-card text-foreground shadow-[var(--shadow-soft)]'
                        : 'text-muted hover:text-foreground'
                    )}
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
                  <Loader2 className="h-8 w-8 animate-spin text-border" />
                </div>
              )}
            </div>
          </div>

          <div className="card-modern p-6 space-y-8">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-7">
              {[
                { label: '시가총액', value: formatMarketCapEok(stock.market_cap, ticker), unit: '억' },
                { label: 'NCAV', value: ncav != null ? formatNumber(ncav / 100000000, 0) : '-', unit: '억' },
                { label: 'PER', value: formatNumber(stock.per), unit: '배' },
                { label: 'PBR', value: formatNumber(stock.pbr), unit: '배' },
                { label: 'ROE', value: formatRatioPercent(stock.roe), unit: '' },
                { label: '배당률', value: formatRatioPercent(stock.dividend_yield), unit: '' },
                { label: '외인', value: formatRatioPercent(stock.foreign_ownership), unit: '' },
              ].map((item, idx) => (
                <div key={idx} className="bg-surface p-4 rounded-2xl shadow-[var(--shadow-soft)]">
                  <p className="mb-1 text-[10px] font-medium text-primary">{item.label}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-semibold text-foreground">{item.value}</span>
                    <span className="text-[10px] font-medium text-primary">{item.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            <BusinessInsightPanel data={businessInsight} isLoading={insightLoading} />

            <div className="space-y-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Newspaper className="h-4 w-4 text-primary" strokeWidth={1.5} /> 관련 최신 뉴스
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {news?.slice(0, 4).map((n) => (
                  <NewsCard key={n.id} news={n} />
                ))}
                {(!news || news.length === 0) && (
                  <div className="col-span-2 rounded-2xl bg-surface p-8 text-center text-xs text-primary font-medium shadow-[var(--shadow-soft)]">
                    최근 7일간 관련 뉴스가 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="card-modern flex flex-col overflow-hidden">
          <div className="p-6 bg-gradient-to-br from-[#f5f0ff] to-[#fefcfb]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Activity className="h-4 w-4" strokeWidth={1.5} /> 퀀트 종목 진단
              </h2>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card text-lg font-semibold text-foreground shadow-[var(--shadow-soft)]">
                {quantScore}
              </div>
            </div>

            <div>
              <p className={cn("text-sm font-semibold", quantGrade.color)}>{quantGrade.label}</p>
              <p className="text-[11px] text-muted mt-1">빌 게이츠(Quality) & 그레이엄(Value) 통합 모델</p>
            </div>
          </div>

          <div className="p-6 flex-1 space-y-8 overflow-y-auto">
            {!stock.ai_analysis ? (
              <div className="flex flex-col items-center justify-center h-full space-y-6 py-20">
                <div className="rounded-full bg-sidebar-active p-4">
                  <Zap className="h-8 w-8 text-primary" strokeWidth={1.5} />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm font-semibold text-foreground">AI 심층 분석이 필요합니다</p>
                  <p className="text-xs text-muted max-w-[200px] mx-auto leading-relaxed">
                    최신 뉴스, 재무 데이터, 기술적 지표를 종합하여 적정 주가와 투자 포인트를 도출합니다.
                  </p>
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="btn-primary flex items-center justify-center gap-2 px-6 py-3 text-xs disabled:opacity-60 w-full max-w-[220px]"
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Activity className="h-4 w-4" strokeWidth={1.5} />
                  )}
                  {isAnalyzing ? '분석 진행 중...' : 'AI 진단 요청하기'}
                </button>
              </div>
            ) : (
              <>
                <div className="p-5 bg-surface rounded-2xl shadow-[var(--shadow-soft)]">
                  <div className="mb-6 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <Target className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} /> 매수 적정가 비교
                    </h3>
                    <ShieldCheck className="h-4 w-4 text-muted" strokeWidth={1.5} />
                  </div>

                  <div className="space-y-8">
                    {/* 통합 스케일 바 */}
                    <div className="relative h-12 w-full px-1">
                      {/* 배경 트랙 */}
                      <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-border" />
                      
                      {/* 자체 휴리스틱 모델 범위 (Blue) */}
                      {quantPrice && (
                        <div
                          className="absolute top-1/2 h-3 -translate-y-1/2 rounded-md bg-blue-500/30 border border-blue-500/50 transition-all duration-1000"
                          style={{
                            left: `${getPos(quantPrice.min)}%`,
                            width: `${getPos(quantPrice.max) - getPos(quantPrice.min)}%`
                          }}
                        />
                      )}

                      {/* Gemini 모델 범위 (Purple) */}
                      {fairPrice && (
                        <div
                          className="absolute top-1/2 h-5 -translate-y-1/2 rounded-md bg-primary/30 border border-primary/50 transition-all duration-1000"
                          style={{
                            left: `${getPos(fairPrice.min)}%`,
                            width: `${getPos(fairPrice.max) - getPos(fairPrice.min)}%`
                          }}
                        />
                      )}

                      {/* 현재가 마커 */}
                      <div
                        className="absolute top-1/2 z-10 h-8 w-0.5 -translate-y-1/2 bg-foreground shadow-sm transition-all duration-1000"
                        style={{ left: `${getPos(currentPrice)}%` }}
                      >
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[9px] font-bold text-background">
                          현재 {formatNumber(currentPrice)}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between px-1 text-[9px] font-bold text-muted uppercase tracking-wider">
                      <span>Low {formatNumber(globalMin)}</span>
                      <span>High {formatNumber(globalMax)}</span>
                    </div>

                    {/* 상세 근거 카드 병렬 배치 */}
                    <div className="grid grid-cols-1 gap-3">
                      <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-3 shadow-sm">
                        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold text-blue-700">
                          <Activity size={12} /> 자체 분석
                        </div>
                        <div className="mb-1 flex justify-between text-[11px] font-bold text-blue-900">
                          <span>{formatNumber(quantPrice?.min)} ~ {formatNumber(quantPrice?.max)}</span>
                        </div>
                        <p className="text-[10px] leading-relaxed text-blue-800/80">
                          {quantPrice?.reason || "정량적 수식 기반 분석 데이터가 없습니다."}
                        </p>
                      </div>

                      <div className="rounded-xl border border-purple-100 bg-purple-50/30 p-3 shadow-sm">
                        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold text-purple-700">
                          <Zap size={12} /> Gemini AI 분석
                        </div>
                        <div className="mb-1 flex justify-between text-[11px] font-bold text-purple-900">
                          <span>{formatNumber(fairPrice?.min)} ~ {formatNumber(fairPrice?.max)}</span>
                        </div>
                        <p className="text-[10px] leading-relaxed text-purple-800/80">
                          {fairPrice?.reason || "Gemini AI의 상세 분석 데이터가 없습니다."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-60 flex items-center justify-center">
                  {stock.ai_analysis?.radar_chart ? (
                    <RadarChartComponent data={stock.ai_analysis.radar_chart} />
                  ) : (
                    <p className="text-[11px] text-muted">데이터를 분석 중입니다...</p>
                  )}
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="mb-2 text-[10px] font-semibold text-primary">Investment Thesis</h3>
                    <p className="text-xs leading-relaxed text-muted font-medium italic">
                      &quot;{stock.ai_analysis?.hot_reason || '정량적 지표 기반 분석이 진행 중입니다.'}&quot;
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="flex items-center gap-1.5 text-[10px] font-semibold text-up">
                        <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} /> 투자 강점 (Quality)
                      </h4>
                      <ul className="space-y-1.5">
                        {stock.ai_analysis?.strengths?.map((s, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-[11px] font-medium text-muted">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-up" />
                            {s}
                          </li>
                        ))}
                        {(!stock.ai_analysis?.strengths || stock.ai_analysis.strengths.length === 0) && (
                          <li className="text-[11px] text-muted">분석된 강점이 없습니다.</li>
                        )}
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="flex items-center gap-1.5 text-[10px] font-semibold text-down">
                        <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.5} /> 리스크 요인 (Risk)
                      </h4>
                      <ul className="space-y-1.5">
                        {stock.ai_analysis?.weaknesses?.map((w, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-[11px] font-medium text-muted">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted" />
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

          {stock.ai_analysis && (
            <div className="p-6 bg-surface flex items-center justify-between">
              <div>
                <h3 className="mb-3 text-[10px] font-semibold text-muted">Overall Signal</h3>
                <div className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold",
                  stock.ai_recommendation === 'Long' ? "bg-[#fde8e8] text-up" :
                  stock.ai_recommendation === 'Short' ? "bg-[#e0f2fe] text-down" : "bg-card text-muted shadow-[var(--shadow-soft)]"
                )}>
                  <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {stock.ai_recommendation?.toUpperCase() || 'NEUTRAL'}
                </div>
              </div>
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="btn-primary flex items-center justify-center gap-1.5 px-4 py-2 text-[11px] disabled:opacity-60"
              >
                {isAnalyzing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Activity className="h-3.5 w-3.5" strokeWidth={1.5} />
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

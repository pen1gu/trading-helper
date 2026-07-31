'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import {
  fetcher,
  apiClient,
  type TechnicalIndicatorsResponse,
  type NewsSummaryResponse,
} from '@/lib/api';
import {
  formatNumber,
  formatRatioPercent,
  formatMarketCapEok,
  isKoreanTicker,
} from '@/lib/format';
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
  BarChart3,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import CandleChart from '@/components/CandleChart';
import RadarChartComponent from '@/components/RadarChart';
import NewsCard from '@/components/NewsCard';
import DisclosureCard from '@/components/DisclosureCard';
import StockHeader from '@/components/StockHeader';
import BusinessInsightPanel, { BusinessInsight } from '@/components/BusinessInsightPanel';
import WhyBuyPanel from '@/components/WhyBuyPanel';
import FinancialsPanel from '@/components/FinancialsPanel';
import EarningsCalendarBadge from '@/components/EarningsCalendarBadge';
import InvestorFlowPanel from '@/components/InvestorFlowPanel';
import RelatedStocksPanel from '@/components/RelatedStocksPanel';
import { cn } from '@/lib/cn';
import { type DisclosuresResponse } from '@/lib/api';

const DISCLOSURE_TYPE_LABELS: Record<string, string> = {
  earnings: '실적',
  dividend: '배당',
  capital: '자본',
  mna: 'M&A',
  other: '기타',
};

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

  const [showAllNews, setShowAllNews] = useState(false);
  const [showAllDisclosures, setShowAllDisclosures] = useState(false);

  const { data: stock, error: stockError } = useSWR<Stock>(`/stocks/${ticker}`, fetcher);

  useEffect(() => {
    if (!ticker || !stock) return;
    apiClient
      .post(`/recent-views/${ticker}`)
      .then(() => {
        mutate((key) => typeof key === 'string' && key.startsWith('/recent-views'));
      })
      .catch(() => {});
  }, [ticker, stock]);

  const { data: technicals } = useSWR<TechnicalIndicatorsResponse>(
    `/stocks/${ticker}/technicals?limit=${range}`,
    fetcher,
  );
  const { data: businessInsight, isLoading: insightLoading } = useSWR<BusinessInsight>(
    `/stocks/${ticker}/business-insight`,
    fetcher,
  );
  const { data: newsSummary } = useSWR<NewsSummaryResponse>(
    `/stocks/${ticker}/news-summary`,
    fetcher,
  );
  const { data: news } = useSWR<News[]>(`/news/stock/${ticker}?limit=30`, fetcher);
  const { data: disclosureData, isLoading: disclosuresLoading } = useSWR<DisclosuresResponse>(
    `/stocks/${ticker}/disclosures?limit=20`,
    fetcher,
  );

  const regularNews = news ?? [];
  const disclosures = disclosureData?.items ?? [];

  const visibleNews = showAllNews ? regularNews : regularNews.slice(0, 5);
  const visibleDisclosures = showAllDisclosures ? disclosures : disclosures.slice(0, 5);
  const { data: watchlist } = useSWR<WatchlistItem[]>('/watchlist', fetcher);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const ncav =
    businessInsight?.deep_value?.ncav ?? stock?.business_insight?.deep_value?.ncav;

  const isWatched = watchlist?.some((w) => w.ticker === ticker);

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

  const allPrices = [
    currentPrice,
    fairPrice?.min,
    fairPrice?.max,
    quantPrice?.min,
    quantPrice?.max,
  ].filter((p): p is number => p != null && p > 0);

  const globalMin = Math.min(...allPrices) * 0.95;
  const globalMax = Math.max(...allPrices) * 1.05;

  const getPos = (val: number) =>
    Math.max(0, Math.min(100, ((val - globalMin) / (globalMax - globalMin)) * 100));

  return (
    <div className="relative flex flex-col overflow-hidden rounded-[40px] bg-surface/50 shadow-[var(--shadow-soft)] min-h-[calc(100vh-180px)]">
      <StockHeader
        stock={stock}
        isWatched={!!isWatched}
        onToggleWatchlist={toggleWatchlist}
      />

      <div className="flex flex-1 flex-col gap-5 xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 pr-2">
          <WhyBuyPanel ticker={ticker} />

          {isKoreanTicker(ticker) && <EarningsCalendarBadge ticker={ticker} />}

          <div className="card-modern p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" strokeWidth={1.5} />
                <h2 className="text-sm font-semibold text-foreground">기술적 분석</h2>
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
                        : 'text-muted hover:text-foreground',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[480px]">
              {technicals?.bars ? (
                <CandleChart data={technicals.bars} snapshot={technicals.snapshot} />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-border" />
                </div>
              )}
            </div>
          </div>

          <InvestorFlowPanel ticker={ticker} />

          <FinancialsPanel ticker={ticker} />

          <div className="card-modern p-6 space-y-6">
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
                <div
                  key={idx}
                  className="rounded-2xl border-2 border-border bg-card py-4 pl-6 pr-4 shadow-[var(--shadow-soft)]"
                >
                  <p className="mb-1 text-sm font-bold uppercase text-primary/80">{item.label}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-foreground">{item.value}</span>
                    <span className="text-[10px] font-bold text-primary/70">{item.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            <BusinessInsightPanel data={businessInsight} isLoading={insightLoading} />
          </div>

          {/* 뉴스 & 공시 병렬 레이아웃 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 뉴스 컬럼 */}
            <div className="card-modern p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Newspaper className="h-4 w-4 text-primary" strokeWidth={2} /> 뉴스
                </h2>
                {regularNews.length > 5 && (
                  <button 
                    onClick={() => setShowAllNews(!showAllNews)}
                    className="text-[10px] font-bold text-primary hover:underline"
                  >
                    {showAllNews ? '접기' : `더보기 (${regularNews.length})`}
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {visibleNews.map((n) => (
                  <NewsCard key={n.id} news={n} />
                ))}
                {regularNews.length === 0 && (
                  <div className="rounded-xl border-2 border-dashed border-border-dark bg-surface p-6 text-center text-[10px] font-bold text-primary">
                    최근 뉴스가 없습니다.
                  </div>
                )}
              </div>
            </div>

            {/* 공시 컬럼 (실제 DART 데이터 연동) */}
            <div className="card-modern p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" strokeWidth={2} /> 공시 정보 (DART)
                </h2>
                {disclosures.length > 5 && (
                  <button 
                    onClick={() => setShowAllDisclosures(!showAllDisclosures)}
                    className="text-[10px] font-bold text-primary hover:underline"
                  >
                    {showAllDisclosures ? '접기' : `더보기 (${disclosures.length})`}
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {disclosuresLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-border" />
                  </div>
                ) : visibleDisclosures.map((item: any) => {
                  const typeLabel = DISCLOSURE_TYPE_LABELS[item.report_type] ?? DISCLOSURE_TYPE_LABELS.other;
                  return (
                    <DisclosureCard
                      key={item.rcept_no}
                      item={item}
                      typeLabel={typeLabel}
                    />
                  );
                })}
                {disclosures.length === 0 && !disclosuresLoading && (
                  <div className="rounded-xl border-2 border-dashed border-border-dark bg-surface p-6 text-center text-[10px] font-bold text-primary">
                    최근 90일 공시 정보가 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* AI 심층 분석 — 오른쪽 고정 패널 */}
        <aside className="w-full shrink-0 p-4 pt-0 xl:w-[360px] xl:p-4 xl:pl-0 xl:pt-4">
          <div className="ai-report-panel flex flex-col overflow-hidden rounded-[28px] xl:sticky xl:top-4 xl:max-h-[calc(100vh-200px)]">
            <div className="ai-report-header flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] shadow-[0_4px_14px_rgba(109,40,217,0.35)]">
                  <Sparkles className="h-4 w-4 text-white" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">AI 심층 분석</h3>
                  <p className="text-[10px] font-medium text-muted">Gemini · 적정가 · 리스크</p>
                </div>
              </div>
              {stock.ai_score != null && (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card text-lg font-bold text-primary shadow-[var(--shadow-soft)]">
                  {stock.ai_score}
                </div>
              )}
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5 scrollbar-hide">
                {!stock.ai_analysis ? (
                  <div className="flex flex-col items-center space-y-4 py-8 text-center">
                    <Zap className="h-8 w-8 text-primary/60" strokeWidth={1.5} />
                    <p className="text-xs font-medium text-muted">
                      AI 서술 분석을 요청하면 투자 포인트와 적정가를 도출합니다.
                    </p>
                    <button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="btn-primary flex items-center gap-2 px-4 py-2 text-[11px] disabled:opacity-60"
                    >
                      {isAnalyzing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Activity className="h-3.5 w-3.5" />
                      )}
                      {isAnalyzing ? '분석 중...' : 'AI 분석 요청'}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl bg-surface p-4">
                      <h4 className="mb-3 flex items-center gap-1.5 text-[10px] font-bold text-foreground">
                        <Target className="h-3 w-3 text-primary" /> 적정가 비교
                      </h4>
                      <div className="relative h-10 w-full">
                        <div className="absolute top-1/2 h-2 w-full -translate-y-1/2 rounded-full bg-border-dark/50" />
                        {quantPrice && (
                          <div
                            className="absolute top-1/2 h-3 -translate-y-1/2 rounded-md border-2 border-blue-500/60 bg-blue-500/30"
                            style={{
                              left: `${getPos(quantPrice.min)}%`,
                              width: `${getPos(quantPrice.max) - getPos(quantPrice.min)}%`,
                            }}
                          />
                        )}
                        {fairPrice && (
                          <div
                            className="absolute top-1/2 h-4 -translate-y-1/2 rounded-md border-2 border-primary/60 bg-primary/30"
                            style={{
                              left: `${getPos(fairPrice.min)}%`,
                              width: `${getPos(fairPrice.max) - getPos(fairPrice.min)}%`,
                            }}
                          />
                        )}
                        <div
                          className="absolute top-1/2 z-10 h-8 w-0.5 -translate-y-1/2 rounded-full bg-foreground"
                          style={{ left: `${getPos(currentPrice)}%` }}
                        />
                      </div>
                      <div className="mt-3 space-y-2">
                        <p className="text-[10px] font-semibold text-foreground">
                          현재 {formatNumber(currentPrice)}
                        </p>
                        {quantPrice && (
                          <div className="rounded-lg border border-blue-100 bg-blue-50/40 px-2.5 py-2">
                            <p className="flex items-center gap-1 text-[9px] font-bold text-blue-700">
                              <Activity className="h-3 w-3" /> 내부 분석
                            </p>
                            <p className="mt-0.5 text-[10px] font-bold text-blue-900">
                              {formatNumber(quantPrice.min)} ~ {formatNumber(quantPrice.max)}
                            </p>
                          </div>
                        )}
                        {fairPrice && (
                          <div className="rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2">
                            <p className="flex items-center gap-1 text-[9px] font-bold text-primary">
                              <Zap className="h-3 w-3" /> AI 분석
                            </p>
                            <p className="mt-0.5 text-[10px] font-bold text-foreground">
                              {formatNumber(fairPrice.min)} ~ {formatNumber(fairPrice.max)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {stock.ai_analysis.radar_chart && (
                      <div className="h-48">
                        <RadarChartComponent data={stock.ai_analysis.radar_chart} />
                      </div>
                    )}

                    <div>
                      <p className="mb-2 text-[11px] font-bold text-primary uppercase tracking-wider">상세 분석</p>
                      <p className="text-[12px] font-bold italic leading-relaxed text-muted bg-surface/50 p-3 rounded-xl border border-border/50">
                        &quot;{stock.ai_analysis.hot_reason || '분석 중'}&quot;
                      </p>
                    </div>

                    <RelatedStocksPanel ticker={ticker} />

                    <div className="space-y-3">
                      <div>
                        <h4 className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-up">
                          <CheckCircle2 className="h-3 w-3" /> 강점
                        </h4>
                        <ul className="space-y-1">
                          {stock.ai_analysis.strengths?.map((s, idx) => (
                            <li key={idx} className="text-[10px] text-muted">
                              · {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-down">
                          <AlertCircle className="h-3 w-3" /> 리스크
                        </h4>
                        <ul className="space-y-1">
                          {stock.ai_analysis.weaknesses?.map((w, idx) => (
                            <li key={idx} className="text-[10px] text-muted">
                              · {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-border/50 pt-3">
                      <div
                        className={cn(
                          'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold',
                          stock.ai_recommendation === 'Long'
                            ? 'bg-[#fde8e8] text-up'
                            : stock.ai_recommendation === 'Short'
                            ? 'bg-[#e0f2fe] text-down'
                            : 'bg-surface text-muted',
                        )}
                      >
                        <TrendingUp className="h-3 w-3" />
                        {stock.ai_recommendation?.toUpperCase() || 'NEUTRAL'}
                      </div>
                      <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                        className="text-[10px] font-semibold text-primary hover:underline disabled:opacity-60"
                      >
                        {isAnalyzing ? '재분석 중...' : '재분석'}
                      </button>
                    </div>
                  </>
                )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Bot, ExternalLink, Loader2, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { fetcher } from '@/lib/api';
import { formatIndexPrice, formatStockPrice } from '@/lib/format';

interface ReportHighlight {
  type: string;
  text: string;
}

interface TopPick {
  ticker: string;
  name: string;
  hot_reason: string;
  news_url?: string | null;
  change_rate?: number;
  current_price?: number;
  price?: number; // legacy fallback
  ai_score?: number;
  key_metrics?: KeyMetrics | null;
}

interface KeyMetrics {
  trade_date?: string;
  current_price?: number;
  prev_close?: number;
  change_rate?: number;
  change_amount?: number;
  day_open?: number;
  day_high?: number;
  day_low?: number;
  volume?: number;
  close_avg_20d?: number;
  close_max_60d?: number;
  close_min_60d?: number;
  vs_avg_20d_pct?: number;
  vs_60d_high_pct?: number;
  vs_60d_low_pct?: number;
  per?: number;
  pbr?: number;
}

interface CompanyReport {
  ticker: string;
  name: string;
  position: 'long' | 'short';
  lines: string[];
  news_citations: string[];
}

function isValidNewsUrl(url?: string | null): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

interface MarketIndex {
  name: string;
  price?: number;
  change?: number;
}

export interface DailyReport {
  market_summary: string;
  highlights: ReportHighlight[];
  long_picks: TopPick[];
  short_picks: TopPick[];
  company_reports: CompanyReport[];
  data_source?: 'live' | 'empty';
  indices: MarketIndex[];
  updated_at?: string;
  next_refresh_at?: string;
  data_collected_at?: string;
  news_collected_at?: string;
  report_generated_at?: string;
}

const PREVIEW_COUNT = 3;
const MAX_VISIBLE = 100;

const INDEX_LABELS: Record<string, string> = {
  '^KS11': 'KOSPI',
  '^KQ11': 'KOSDAQ',
  '^GSPC': 'S&P 500',
  'USDKRW=X': 'USD/KRW',
};

function formatCountdown(targetIso?: string): string {
  if (!targetIso) return '--:--:--';
  const target = new Date(targetIso).getTime();
  const diff = Math.max(0, target - Date.now());
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatPct(value?: number): string {
  if (value == null) return '-';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatNumber(value?: number): string {
  if (value == null) return '-';
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}

function MetricsCell({ pick }: { pick: TopPick }) {
  const metrics = pick.key_metrics;
  const price = metrics?.current_price ?? pick.current_price ?? pick.price;
  const changeRate = metrics?.change_rate ?? pick.change_rate;
  const changeAmount = metrics?.change_amount;
  const changeClass =
    (changeRate ?? 0) > 0
      ? 'text-red-600'
      : (changeRate ?? 0) < 0
        ? 'text-blue-600'
        : 'text-neutral-500';

  return (
    <div className="space-y-1 whitespace-nowrap text-xs">
      <div className="text-sm font-bold text-neutral-900">
        {formatStockPrice(price, pick.ticker)}
      </div>
      <div className={`font-semibold ${changeClass}`}>
        전일비 {formatPct(changeRate)}
        {changeAmount != null ? ` (${changeAmount > 0 ? '+' : ''}${formatNumber(changeAmount)})` : ''}
      </div>
      {(metrics?.day_low != null || metrics?.day_high != null) && (
        <div className="text-neutral-500">
          당일 {formatNumber(metrics.day_low)} ~ {formatNumber(metrics.day_high)}
        </div>
      )}
      {metrics?.vs_avg_20d_pct != null && (
        <div className="text-neutral-400">
          20일 평균 대비 {formatPct(metrics.vs_avg_20d_pct)}
        </div>
      )}
      {metrics?.vs_60d_high_pct != null && (
        <div className="text-neutral-400">
          60일 고점 대비 {formatPct(metrics.vs_60d_high_pct)}
        </div>
      )}
      {(metrics?.per != null || metrics?.pbr != null) && (
        <div className="text-neutral-400">
          PER {formatNumber(metrics.per)} · PBR {formatNumber(metrics.pbr)}
        </div>
      )}
    </div>
  );
}

function PicksTable({
  picks,
  variant,
  expanded,
  onToggleExpand,
}: {
  picks: TopPick[];
  variant: 'long' | 'short';
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const isLong = variant === 'long';
  const headerBg = isLong ? 'bg-neutral-50' : 'bg-neutral-100';
  const headerText = isLong ? 'text-neutral-900' : 'text-neutral-600';
  const capped = picks.slice(0, MAX_VISIBLE);
  const visible = expanded ? capped : capped.slice(0, PREVIEW_COUNT);
  const canExpand = capped.length > PREVIEW_COUNT;

  return (
    <div className="card-modern overflow-hidden">
      <div
        className={`flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3 ${headerBg}`}
      >
        <div className="flex items-center gap-2">
          {isLong ? (
            <TrendingUp className={`h-5 w-5 ${headerText}`} />
          ) : (
            <TrendingDown className={`h-5 w-5 ${headerText}`} />
          )}
          <h3 className={`font-bold ${headerText}`}>
            {isLong ? '매수 (롱)' : '매도 (숏)'}
            <span className="ml-2 text-sm font-normal text-neutral-500">
              {expanded ? `전체 ${visible.length}건` : `Top ${Math.min(PREVIEW_COUNT, capped.length)}`}
            </span>
          </h3>
        </div>
        {canExpand && (
          <button
            type="button"
            onClick={onToggleExpand}
            className="text-xs font-semibold text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
          >
            {expanded ? '접기' : `더보기 (최대 ${Math.min(MAX_VISIBLE, capped.length)}건)`}
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-3">종목</th>
              <th className="px-4 py-3">핫 이슈</th>
              <th className="px-4 py-3 whitespace-nowrap">수치</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-neutral-400">
                  표시할 종목이 없습니다.{' '}
                  <Link href="/data" className="font-bold text-indigo-600 underline underline-offset-2">
                    데이터 로딩 페이지
                  </Link>
                  에서 당일 데이터를 적재하면 화면이 갱신됩니다.
                </td>
              </tr>
            )}
            {visible.map((pick) => (
              <tr key={pick.ticker} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors">
                <td className="px-4 py-3 align-top">
                  <Link href={`/stocks/${pick.ticker}`} className="group block">
                    <div className="font-bold text-neutral-900 group-hover:text-indigo-600 transition-colors">{pick.name}</div>
                    <div className="text-xs text-neutral-400 group-hover:text-indigo-400 transition-colors">{pick.ticker}</div>
                  </Link>
                </td>
                <td className="max-w-xs px-4 py-3 align-top leading-relaxed text-neutral-600">
                  {isValidNewsUrl(pick.news_url) ? (
                    <a
                      href={pick.news_url}
                      target="_blank"
                      rel="noreferrer"
                      className="group inline-flex items-start gap-1.5 text-neutral-600 underline-offset-2 transition-colors hover:text-neutral-900 hover:underline"
                    >
                      <span>{pick.hot_reason}</span>
                      <ExternalLink
                        size={14}
                        className="mt-0.5 shrink-0 text-neutral-400 transition-colors group-hover:text-neutral-700"
                        aria-hidden
                      />
                    </a>
                  ) : (
                    pick.hot_reason
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  <MetricsCell pick={pick} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DailyReportSection() {
  const { data, error, isLoading } = useSWR<DailyReport>('/report/daily', fetcher);
  const [countdown, setCountdown] = useState('--:--:--');
  const [longExpanded, setLongExpanded] = useState(false);
  const [shortExpanded, setShortExpanded] = useState(false);

  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(data?.next_refresh_at));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [data?.next_refresh_at]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-6 text-center text-sky-800 font-medium">
        리포트를 불러오지 못했습니다. 백엔드 서버가 실행 중인지 확인해주세요.
      </div>
    );
  }

  if (!data) return null;

  const isLive = data.data_source === 'live';

  return (
    <div className="space-y-6">
      {!isLive && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
          아직 수집된 데이터가 없습니다.{' '}
          <Link href="/data" className="font-bold text-amber-800 underline underline-offset-2 hover:text-amber-950">
            데이터 로딩 페이지
          </Link>
          에서 시세·뉴스 수집을 실행해주세요.
        </p>
      )}
      {isLive && data.data_collected_at && (
        <p className="text-xs text-sky-500 font-bold uppercase tracking-wider">
          Market Snapshot: {new Date(data.data_collected_at).toLocaleString('ko-KR')}
        </p>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <PicksTable
            picks={data.long_picks ?? []}
            variant="long"
            expanded={longExpanded}
            onToggleExpand={() => setLongExpanded((v) => !v)}
          />
          <PicksTable
            picks={data.short_picks ?? []}
            variant="short"
            expanded={shortExpanded}
            onToggleExpand={() => setShortExpanded((v) => !v)}
          />
        </div>

        <section className="card-modern p-6 bg-white flex flex-col">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 shadow-[0_2px_8px_rgba(79,70,229,0.1)]">
                <Bot className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 uppercase tracking-tight">AI Report</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gemini Analysis</p>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-1.5">
              <Link
                href="/data"
                className="btn-primary flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] shadow-sm"
              >
                <Zap className="h-3.5 w-3.5" />
                데이터 로딩에서 리포트 작성
              </Link>
              {data.report_generated_at && (
                <p className="text-right text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                  Update: {new Date(data.report_generated_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
          
          <div className="space-y-5 text-left">
            {/* 시장 요약 통합 */}
            {data.market_summary && (
              <div className="rounded-2xl bg-slate-900 p-5 text-white shadow-lg shadow-slate-900/10">
                <h4 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-300">
                  <Zap className="h-4 w-4 text-yellow-400" /> Daily Briefing
                </h4>
                <p className="text-base leading-relaxed text-slate-100 font-medium">
                  {data.market_summary}
                </p>
                {data.highlights?.length > 0 && (
                  <div className="mt-4 space-y-2 border-t border-slate-700 pt-4">
                    {data.highlights.map((h, i) => (
                      <div key={i} className="flex items-start gap-2 text-[13px] font-medium">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                        <span className="text-slate-300">{h.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {data.company_reports?.length ? (
              <>
                {(['long', 'short'] as const).map((position) => {
                  const reports = data.company_reports.filter((r) => r.position === position);
                  if (!reports.length) return null;
                  return (
                    <div key={position} className="space-y-3">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {position === 'long' ? '매수(롱) Top5' : '매도(숏) Top5'}
                      </h4>
                      {reports.map((report) => (
                        <div key={`${position}-${report.ticker}`} className="rounded-2xl border border-slate-100 p-4 shadow-sm hover:border-indigo-200 hover:bg-slate-50 transition-all group">
                          <Link href={`/stocks/${report.ticker}`} className="block mb-3 text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {report.name} <span className="text-xs font-bold text-slate-400 uppercase ml-1 group-hover:text-indigo-400">{report.ticker}</span>
                          </Link>
                          <ul className="space-y-2 text-sm leading-relaxed text-slate-600 font-medium">
                            {report.lines.slice(0, 3).map((line, i) => (
                              <li key={i} className="flex gap-2.5">
                                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                                {line}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="rounded-2xl bg-slate-50/50 border border-dashed border-slate-200 p-8 text-center">
                <p className="text-xs font-bold text-slate-400 leading-relaxed">
                  아직 작성된 AI 리포트가 없습니다.<br/>
                  <Link href="/data" className="font-bold text-indigo-600 underline underline-offset-2">
                    데이터 로딩 페이지
                  </Link>
                  에서 AI 리포트를 작성해주세요.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export function MacroTicker({ indices }: { indices: MarketIndex[] }) {
  if (!indices.length) {
    return (
      <section className="card-modern px-4 py-3 text-sm text-neutral-500">
        시장 지수 데이터 없음.{' '}
        <Link href="/data" className="font-bold text-indigo-600 underline underline-offset-2">
          데이터 로딩 페이지
        </Link>
        에서 시세 수집 후 표시됩니다.
      </section>
    );
  }

  const items = indices.map((idx) => {
    const label = INDEX_LABELS[idx.name] || idx.name;
    const price = formatIndexPrice(idx.price, idx.name);
    const change = idx.change ?? 0;
    const arrow = change >= 0 ? '▲' : '▼';
    const color = change >= 0 ? 'text-red-600 font-bold' : 'text-blue-600 font-bold';
    return (
      <span key={idx.name}>
        {label}: {price}{' '}
        <span className={color}>
          {arrow} {Math.abs(change).toFixed(1)}%
        </span>
      </span>
    );
  });

  return (
    <section className="card-modern overflow-hidden py-3">
      <div className="flex animate-marquee gap-12 whitespace-nowrap px-4 text-sm font-medium text-neutral-500">
        {[...items, ...items].map((item, i) => (
          <span key={i}>{item}</span>
        ))}
      </div>
    </section>
  );
}

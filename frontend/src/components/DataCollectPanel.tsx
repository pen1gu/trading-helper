'use client';

import { useState, type ReactNode } from 'react';
import { mutate } from 'swr';
import {
  Database,
  Newspaper,
  BarChart3,
  Globe,
  Bot,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useGenerateReport } from '@/hooks/useGenerateReport';
import { clsx } from 'clsx';

export interface CollectStatus {
  market: {
    last_collected_at?: string | null;
    trade_date?: string | null;
    stock_count: number;
    universe_estimate: number;
  };
  news: {
    last_collected_at?: string | null;
    total_articles: number;
    stocks_with_news: number;
  };
  financials: {
    last_collected_at?: string | null;
    analyzed_count: number;
    watchlist_analyzed: number;
    watchlist_total: number;
    pending_watchlist: number;
  };
  report: {
    last_generated_at?: string | null;
    next_refresh_at?: string | null;
  };
}

type ActionKind =
  | 'market'
  | 'news'
  | 'insight-watchlist'
  | 'insight-all'
  | 'report';

interface ActionConfig {
  kind: ActionKind;
  label: string;
  description: string;
  icon: typeof Database;
  variant: 'sky' | 'amber' | 'emerald' | 'violet' | 'indigo';
  warning?: string;
  lastUpdatedAt?: string | null;
}

function getStreamUrl(kind: ActionKind): string | null {
  switch (kind) {
    case 'market':
      return `${API_BASE_URL}/report/collect-stream?target=market`;
    case 'news':
      return `${API_BASE_URL}/report/collect-stream?target=news`;
    case 'insight-watchlist':
      return `${API_BASE_URL}/report/insight-stream?scope=watchlist`;
    case 'insight-all':
      return `${API_BASE_URL}/report/insight-stream?scope=all`;
    default:
      return null;
  }
}

function variantStyles(variant: ActionConfig['variant'], status: 'idle' | 'running' | 'done' | 'error') {
  if (status === 'error') return 'bg-red-500 text-white shadow-lg shadow-red-100';
  if (status === 'done') return 'bg-emerald-600 text-white shadow-lg shadow-emerald-100';
  const map = {
    sky: 'bg-sky-600 text-white hover:bg-sky-700 shadow-lg shadow-sky-100 disabled:bg-sky-100 disabled:text-sky-400',
    amber: 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-100 disabled:bg-amber-100 disabled:text-amber-300',
    emerald: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100 disabled:bg-emerald-100 disabled:text-emerald-300',
    violet: 'bg-violet-600 text-white hover:bg-violet-700 shadow-lg shadow-violet-100 disabled:bg-violet-100 disabled:text-violet-300',
    indigo: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 disabled:bg-indigo-100 disabled:text-indigo-300',
  };
  return map[variant];
}

function CollectActionButton({
  config,
  disabled,
  onComplete,
}: {
  config: ActionConfig;
  disabled?: boolean;
  onComplete: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const { generate, loading: generating } = useGenerateReport();
  const Icon = config.icon;

  const isReport = config.kind === 'report';
  const isRunning = loading || (isReport && generating);

  const handleClick = async () => {
    if (isRunning || disabled) return;

    if (isReport) {
      setStatus('running');
      setProgress(50);
      setMessage('AI 리포트 작성 중...');
      const ok = await generate();
      if (!ok) {
        setStatus('error');
        setMessage('AI 리포트 작성에 실패했습니다.');
      } else {
        setStatus('done');
        setProgress(100);
        setMessage('리포트 작성 완료');
        onComplete();
        setTimeout(() => {
          setStatus('idle');
          setMessage('');
          setProgress(0);
        }, 5000);
      }
      return;
    }

    setLoading(true);
    setStatus('running');
    setProgress(0);
    setMessage(`${config.label} 시작...`);

    const url = getStreamUrl(config.kind)!;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data.progress ?? 0);
      setMessage(data.message ?? '');

      if (data.status === 'done') {
        eventSource.close();
        setStatus('done');
        setLoading(false);
        onComplete();
        setTimeout(() => {
          setStatus('idle');
          setMessage('');
          setProgress(0);
        }, 5000);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setStatus('error');
      setMessage(`${config.label} 중 오류가 발생했습니다.`);
      setLoading(false);
      setTimeout(() => {
        setStatus('idle');
        setMessage('');
      }, 5000);
    };
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={clsx(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          config.variant === 'sky' && 'bg-sky-50 text-sky-600',
          config.variant === 'amber' && 'bg-amber-50 text-amber-600',
          config.variant === 'emerald' && 'bg-emerald-50 text-emerald-600',
          config.variant === 'violet' && 'bg-violet-50 text-violet-600',
          config.variant === 'indigo' && 'bg-indigo-50 text-indigo-600',
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black text-slate-900">{config.label}</h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{config.description}</p>
          {config.warning && (
            <p className="mt-1.5 text-[10px] font-bold text-amber-600">{config.warning}</p>
          )}
        </div>
      </div>

      {config.lastUpdatedAt ? (
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
          <Clock size={10} />
          <span>최근: {formatDate(config.lastUpdatedAt, 'YYYY-MM-DD HH:mm:ss')}</span>
        </div>
      ) : (
        <div className="text-[10px] font-bold text-slate-300">수집 이력 없음</div>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={isRunning || disabled}
        className={clsx(
          'relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-3 text-xs font-black transition-all',
          variantStyles(config.variant, status),
        )}
      >
        {isRunning && (
          <div
            className="absolute left-0 top-0 h-full bg-white/25 transition-all duration-300"
            style={{ width: isReport ? '100%' : `${progress}%` }}
          />
        )}
        <span className="relative flex items-center gap-2">
          {status === 'done' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : status === 'error' ? (
            <AlertCircle className="h-4 w-4" />
          ) : isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Icon className="h-4 w-4" />
          )}
          {status === 'done'
            ? '완료'
            : status === 'error'
            ? '오류'
            : isRunning
            ? isReport
              ? '작성 중...'
              : `${progress}%`
            : '실행'}
        </span>
      </button>

      {message && (
        <p
          className={clsx(
            'text-[10px] font-bold text-center truncate',
            status === 'done' ? 'text-emerald-600' : status === 'error' ? 'text-red-500' : 'text-slate-500',
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
}

function StatusCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Database;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-indigo-500" />
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">{title}</h3>
      </div>
      <dl className="space-y-2 text-sm">{children}</dl>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
      <dd className="text-[11px] font-black text-slate-900 text-right">{value}</dd>
    </div>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return formatDate(value, 'YYYY-MM-DD HH:mm:ss');
}

export function CollectStatusPanel({ status }: { status?: CollectStatus }) {
  if (!status) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatusCard title="시세" icon={Database}>
        <StatusRow label="마지막 수집" value={formatDateTime(status.market.last_collected_at)} />
        <StatusRow label="기준 거래일" value={status.market.trade_date ?? '-'} />
        <StatusRow label="수집 종목" value={`${status.market.stock_count.toLocaleString()}개`} />
        <StatusRow label="유니버스" value={`~${status.market.universe_estimate.toLocaleString()}개`} />
      </StatusCard>
      <StatusCard title="뉴스" icon={Newspaper}>
        <StatusRow label="마지막 수집" value={formatDateTime(status.news.last_collected_at)} />
        <StatusRow label="총 기사" value={`${status.news.total_articles.toLocaleString()}건`} />
        <StatusRow label="뉴스 보유 종목" value={`${status.news.stocks_with_news.toLocaleString()}개`} />
      </StatusCard>
      <StatusCard title="재무·사업" icon={BarChart3}>
        <StatusRow label="마지막 분석" value={formatDateTime(status.financials.last_collected_at)} />
        <StatusRow label="분석 완료" value={`${status.financials.analyzed_count.toLocaleString()}종목`} />
        <StatusRow
          label="관심종목"
          value={`${status.financials.watchlist_analyzed}/${status.financials.watchlist_total}`}
        />
        <StatusRow label="관심종목 대기" value={`${status.financials.pending_watchlist}개`} />
      </StatusCard>
      <StatusCard title="AI 리포트" icon={Bot}>
        <StatusRow label="마지막 작성" value={formatDateTime(status.report.last_generated_at)} />
        <StatusRow label="다음 갱신" value={formatDateTime(status.report.next_refresh_at)} />
      </StatusCard>
    </div>
  );
}

export default function DataCollectPanel({ status }: { status?: CollectStatus }) {
  const refreshAll = () => {
    mutate('/report/collect-status');
    mutate('/report/daily');
    mutate('/stocks');
    mutate('/stocks/scan');
    mutate('/news');
  };

  const actions: ActionConfig[] = [
    {
      kind: 'market',
      label: '주식 데이터 수집',
      description: '시세·일봉 데이터를 수집합니다. 재무 분석은 포함되지 않습니다.',
      icon: Database,
      variant: 'sky',
      lastUpdatedAt: status?.market.last_collected_at,
    },
    {
      kind: 'news',
      label: '뉴스 데이터 수집',
      description: '종목별 최신 뉴스를 Google News RSS에서 수집합니다.',
      icon: Newspaper,
      variant: 'amber',
      lastUpdatedAt: status?.news.last_collected_at,
    },
    {
      kind: 'insight-watchlist',
      label: '재무·사업 분석 (관심종목)',
      description: '관심종목만 DART/SEC 재무 공시를 분석합니다.',
      icon: BarChart3,
      variant: 'emerald',
      lastUpdatedAt: status?.financials.last_collected_at,
    },
    {
      kind: 'insight-all',
      label: '재무·사업 분석 (전체)',
      description: 'KR Top 1000 + 유니버스 전체 재무 공시를 분석합니다.',
      icon: Globe,
      variant: 'violet',
      warning: '수백~1000종목, 30분 이상 소요될 수 있습니다.',
      lastUpdatedAt: status?.financials.last_collected_at,
    },
    {
      kind: 'report',
      label: 'AI 리포트 작성',
      description: '수집된 데이터와 뉴스를 바탕으로 롱/숏 Top5 리포트를 생성합니다.',
      icon: Bot,
      variant: 'indigo',
      lastUpdatedAt: status?.report.last_generated_at,
    },
  ];

  return (
    <div className="space-y-8">
      <CollectStatusPanel status={status} />
      <div>
        <h2 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">수집 액션</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {actions.map((action) => (
            <CollectActionButton key={action.kind} config={action} onComplete={refreshAll} />
          ))}
        </div>
      </div>
    </div>
  );
}

'use client';

import {
  Loader2,
  Scale,
  Shield,
  TrendingUp,
  Activity,
  Zap,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import useSWR from 'swr';
import { fetcher, type BuyRationaleResponse, type BuyRationalePillar } from '@/lib/api';
import { formatDate, isLikelyWarrantOrNonEquity } from '@/lib/format';
import { cn } from '@/lib/cn';

const PILLAR_META: Record<
  string,
  { icon: React.ElementType; color: string; bg: string }
> = {
  value: { icon: Scale, color: 'text-[#2563eb]', bg: 'bg-[#e0f2fe]' },
  quality: { icon: Shield, color: 'text-[#059669]', bg: 'bg-[#d1fae5]' },
  growth: { icon: TrendingUp, color: 'text-primary', bg: 'bg-sidebar-active' },
  momentum: { icon: Activity, color: 'text-[#d97706]', bg: 'bg-[#fffbeb]' },
  catalyst: { icon: Zap, color: 'text-[#7c3aed]', bg: 'bg-[#ede9fe]' },
};

function scoreColor(score: number) {
  if (score >= 70) return 'bg-[#d1fae5] text-[#047857]';
  if (score >= 50) return 'bg-[#fffbeb] text-[#b45309]';
  if (score >= 30) return 'bg-surface text-muted';
  return 'bg-[#fde8e8] text-up';
}

function verdictStyle(verdict: string) {
  const v = verdict.toLowerCase();
  if (v.includes('강력') || v.includes('strong')) {
    return 'bg-[#d1fae5] text-[#047857] border-[#6ee7b7]';
  }
  if (v.includes('매수') || v.includes('buy')) {
    return 'bg-sidebar-active text-primary border-[#c4b5fd]';
  }
  if (v.includes('회피') || v.includes('avoid') || v.includes('short')) {
    return 'bg-[#fde8e8] text-up border-[#fca5a5]';
  }
  return 'bg-surface text-muted border-border';
}

function PillarCard({ pillar }: { pillar: BuyRationalePillar }) {
  const meta = PILLAR_META[pillar.id] ?? PILLAR_META.value;
  const Icon = meta.icon;

  return (
    <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-xl', meta.bg)}>
            <Icon className={cn('h-4 w-4', meta.color)} strokeWidth={1.5} />
          </div>
          <h3 className="text-xs font-semibold text-foreground">{pillar.label}</h3>
        </div>
        <span className={cn('rounded-lg px-2 py-1 text-xs font-bold', scoreColor(pillar.score))}>
          {pillar.score}
        </span>
      </div>

      <ul className="space-y-1.5">
        {pillar.bullets.length > 0 ? (
          pillar.bullets.map((bullet, idx) => (
            <li key={idx} className="flex items-start gap-2 text-[11px] font-medium text-muted">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
              {bullet}
            </li>
          ))
        ) : (
          <li className="text-[11px] text-muted">데이터 부족</li>
        )}
      </ul>

      {pillar.risks && pillar.risks.length > 0 && (
        <div className="mt-3 flex items-start gap-1.5 rounded-xl bg-[#fffbeb] px-2.5 py-2">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[#d97706]" strokeWidth={2} />
          <p className="text-[10px] font-medium text-[#b45309]">{pillar.risks[0]}</p>
        </div>
      )}
    </div>
  );
}

interface Props {
  ticker: string;
}

export default function WhyBuyPanel({ ticker }: Props) {
  const { data, isLoading, error } = useSWR<BuyRationaleResponse>(
    `/stocks/${ticker}/buy-rationale`,
    fetcher,
  );

  if (isLoading) {
    return (
      <div className="card-modern flex items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-xs text-muted">매수 근거 분석 중...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card-modern p-6 text-center">
        <p className="text-xs font-medium text-muted">매수 근거 데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const freshnessEntries = Object.entries(data.data_freshness ?? {}).filter(
    ([, v]) => v != null,
  );

  const showNonEquityHint = isLikelyWarrantOrNonEquity(ticker);

  return (
    <div className="card-modern p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">왜 사야 하는가?</h2>
          <p className="mt-0.5 text-[11px] text-muted">5축 규칙 기반 매수 근거</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sidebar-active text-2xl font-bold text-primary shadow-[var(--shadow-soft)]">
            {data.overall_score}
          </div>
          <span
            className={cn(
              'rounded-xl border-2 px-4 py-2 text-xs font-bold',
              verdictStyle(data.verdict),
            )}
          >
            {data.verdict}
          </span>
        </div>
      </div>

      {showNonEquityHint && (
        <div className="flex items-start gap-2 rounded-xl bg-[#fffbeb] px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#d97706]" strokeWidth={2} />
          <p className="text-[11px] font-medium text-[#b45309]">
            워런트·단위증권은 재무·가치 지표가 비어 있을 수 있어 점수가 참고용에 가깝습니다.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {data.pillars.map((pillar) => (
          <PillarCard key={pillar.id} pillar={pillar} />
        ))}
      </div>

      {freshnessEntries.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-4">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted">
            <Clock size={11} strokeWidth={1.5} />
            데이터 기준
          </div>
          {freshnessEntries.map(([key, value]) => (
            <span
              key={key}
              className="rounded-lg bg-surface px-2 py-1 text-[10px] font-medium text-muted"
            >
              {key}: {formatDate(value, 'YYYY-MM-DD HH:mm')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

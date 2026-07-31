'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Loader2, Users, Info } from 'lucide-react';
import useSWR from 'swr';
import { fetcher, type InvestorFlowResponse } from '@/lib/api';
import { formatNumber, isKoreanTicker } from '@/lib/format';
import { chartColors } from '@/lib/chart-colors';
import { cn } from '@/lib/cn';

function formatFlowEok(value?: number | null): string {
  if (value == null) return '-';
  const eok = value / 100_000_000;
  const sign = eok > 0 ? '+' : '';
  return `${sign}${formatNumber(eok, 0)}억`;
}

const SIGNAL_LABELS: Record<string, { label: string; color: string }> = {
  strong_buy: { label: '강한 매수', color: 'bg-[#d1fae5] text-[#047857]' },
  buy: { label: '매수', color: 'bg-sidebar-active text-primary' },
  neutral: { label: '중립', color: 'bg-surface text-muted' },
  sell: { label: '매도', color: 'bg-[#fde8e8] text-up' },
};

interface Props {
  ticker: string;
}

export default function InvestorFlowPanel({ ticker }: Props) {
  const isKr = isKoreanTicker(ticker);

  const { data, isLoading } = useSWR<InvestorFlowResponse>(
    isKr ? `/stocks/${ticker}/investor-flow?days=60` : null,
    fetcher,
  );

  if (!isKr) {
    return (
      <div className="card-modern p-6 text-center">
        <Info className="mx-auto mb-2 h-5 w-5 text-muted" strokeWidth={1.5} />
        <p className="text-xs font-medium text-muted">
          수급 데이터는 국내 종목만 제공됩니다.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="card-modern flex items-center justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-xs text-muted">수급 데이터 로딩 중...</span>
      </div>
    );
  }

  if (!data || data.status !== 'ok' || !data.daily?.length) {
    return (
      <div className="card-modern p-6 text-center">
        <Info className="mx-auto mb-2 h-5 w-5 text-muted" strokeWidth={1.5} />
        <p className="text-xs font-medium text-muted">
          {data?.message || '수급 데이터를 수집할 수 없습니다.'}
        </p>
      </div>
    );
  }

  const chartData = data.daily.map((d) => ({
    date: d.trade_date.slice(5),
    foreign: d.foreign_net / 100_000_000,
    institutional: d.institutional_net / 100_000_000,
    individual: d.individual_net / 100_000_000,
  }));

  const signal = data.snapshot.flow_signal
    ? SIGNAL_LABELS[data.snapshot.flow_signal] ?? SIGNAL_LABELS.neutral
    : null;

  return (
    <div className="card-modern p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Users className="h-4 w-4 text-primary" strokeWidth={1.5} />
          투자자 수급
        </h2>
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-surface px-2 py-0.5 text-[10px] font-semibold text-muted">
            pykrx
          </span>
          {signal && (
            <span className={cn('rounded-lg px-2 py-0.5 text-[10px] font-semibold', signal.color)}>
              {signal.label}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '외국인 5일', value: data.snapshot.foreign_net_5d },
          { label: '외국인 20일', value: data.snapshot.foreign_net_20d },
          { label: '기관 5일', value: data.snapshot.institutional_net_5d },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl bg-surface p-3 text-center shadow-[var(--shadow-soft)]"
          >
            <p className="mb-1 text-[10px] font-semibold text-muted">{item.label}</p>
            <p
              className={cn(
                'text-xs font-bold tabular-nums',
                (item.value ?? 0) > 0 ? 'text-up' : (item.value ?? 0) < 0 ? 'text-down' : 'text-muted',
              )}
            >
              {formatFlowEok(item.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: chartColors.axis }}
              axisLine={false}
              tickLine={false}
              minTickGap={30}
            />
            <YAxis
              tick={{ fontSize: 9, fill: chartColors.axis }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}`}
              width={40}
            />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #f0e8f5' }}
              formatter={(value) => [`${value}억`, '']}
            />
            <ReferenceLine y={0} stroke={chartColors.axis} strokeWidth={1} />
            <Bar dataKey="foreign" name="외국인" fill={chartColors.down} radius={[2, 2, 0, 0]} />
            <Bar dataKey="institutional" name="기관" fill={chartColors.series[0]} radius={[2, 2, 0, 0]} />
            <Bar dataKey="individual" name="개인" fill={chartColors.axis} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {data.snapshot.flow_streak != null && data.snapshot.flow_streak > 0 && (
        <p className="text-[10px] font-medium text-muted">
          외국인 연속 순매수 {data.snapshot.flow_streak}일
        </p>
      )}
    </div>
  );
}

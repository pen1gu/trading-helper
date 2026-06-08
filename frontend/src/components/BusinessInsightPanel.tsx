'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Loader2, Shield, FlaskConical, Landmark, Info } from 'lucide-react';
import { clsx } from 'clsx';

interface InsightMetric {
  score?: number;
  interpretation?: string;
  label?: string;
  deferred_revenue_ratio?: number;
  gross_margin_stability?: number;
  rd_intensity_pct?: number;
  rd_vs_revenue_growth?: number;
  capex_to_depreciation?: number;
  profile?: string;
  breakdown_5y_avg?: Record<string, number>;
  long_term_signal?: string;
}

export interface BusinessInsight {
  status: string;
  message?: string;
  moat_proxy?: InsightMetric;
  rd_efficiency?: InsightMetric;
  capital_allocation?: InsightMetric;
  data_years?: number[];
  source?: string;
  collected_at?: string;
}

interface Props {
  data?: BusinessInsight;
  isLoading?: boolean;
}

const ALLOCATION_COLORS: Record<string, string> = {
  capex: '#3b82f6',
  rd: '#8b5cf6',
  dividends: '#22c55e',
  buybacks: '#f59e0b',
  debt: '#ef4444',
};

const ALLOCATION_LABELS: Record<string, string> = {
  capex: 'CapEx',
  rd: 'R&D',
  dividends: '배당',
  buybacks: '자사주',
  debt: '부채상환',
};

function ScoreBadge({ score }: { score?: number }) {
  if (score == null) return <span className="text-xs text-neutral-400">-</span>;
  const color =
    score >= 70 ? 'bg-emerald-50 text-emerald-700' :
    score >= 40 ? 'bg-amber-50 text-amber-700' :
    'bg-red-50 text-red-600';
  return (
    <span className={clsx('rounded-lg px-2 py-1 text-xs font-black', color)}>
      {score}
    </span>
  );
}

function MetricCard({
  icon: Icon,
  title,
  metric,
  children,
}: {
  icon: React.ElementType;
  title: string;
  metric?: InsightMetric;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-bold text-neutral-900">
          <Icon className="h-3.5 w-3.5 text-neutral-400" />
          {title}
        </h3>
        <ScoreBadge score={metric?.score} />
      </div>
      {children}
      {metric?.interpretation && (
        <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">
          {metric.interpretation}
        </p>
      )}
    </div>
  );
}

export default function BusinessInsightPanel({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-white p-10">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-300" />
        <span className="ml-2 text-xs text-neutral-400">재무 공시 데이터 분석 중...</span>
      </div>
    );
  }

  if (!data || data.status === 'unavailable' || data.status === 'not_found') {
    return (
      <div className="rounded-xl border border-dashed border-neutral-200 bg-white p-6 text-center">
        <Info className="mx-auto mb-2 h-5 w-5 text-neutral-300" />
        <p className="text-xs font-medium text-neutral-500">
          {data?.message || '재무 공시 데이터를 수집할 수 없습니다.'}
        </p>
        <p className="mt-1 text-[10px] text-neutral-400">
          SEC EDGAR(미국) 또는 DART(한국) 공시 데이터가 필요합니다.
        </p>
      </div>
    );
  }

  const breakdown = data.capital_allocation?.breakdown_5y_avg || {};
  const chartData = Object.entries(breakdown)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: ALLOCATION_LABELS[key] || key,
      value,
      key,
    }));

  const profileLabels: Record<string, string> = {
    growth: '성장 투자',
    balanced: '균형',
    shareholder_return: '주주 환원',
    deleveraging: '부채 상환',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-neutral-900">
          <Landmark className="h-4 w-4 text-neutral-400" />
          핵심 사업·경영 분석
        </h2>
        <div className="flex items-center gap-2">
          <span className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-500">
            프록시 지표
          </span>
          {data.source && (
            <span className="text-[10px] text-neutral-400 uppercase">{data.source}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard icon={Shield} title="전환 비용 프록시" metric={data.moat_proxy}>
          <div className="space-y-1 text-[11px] text-neutral-600">
            {data.moat_proxy?.deferred_revenue_ratio != null && (
              <p>
                계약부채/매출:{' '}
                {Math.min(data.moat_proxy.deferred_revenue_ratio, 1) * 100 <= 100
                  ? `${(Math.min(data.moat_proxy.deferred_revenue_ratio, 1) * 100).toFixed(1)}%`
                  : 'N/A'}
              </p>
            )}
            {data.moat_proxy?.gross_margin_stability != null && (
              <p>마진 변동성(σ): {data.moat_proxy.gross_margin_stability.toFixed(2)}%p</p>
            )}
          </div>
        </MetricCard>

        <MetricCard icon={FlaskConical} title="R&D 효율" metric={data.rd_efficiency}>
          <div className="space-y-1 text-[11px] text-neutral-600">
            {data.rd_efficiency?.rd_intensity_pct != null && (
              <p>R&D/매출: {data.rd_efficiency.rd_intensity_pct.toFixed(1)}%</p>
            )}
            {data.rd_efficiency?.capex_to_depreciation != null && (
              <p>CapEx/감가상각: {data.rd_efficiency.capex_to_depreciation.toFixed(2)}x</p>
            )}
          </div>
        </MetricCard>

        <MetricCard icon={Landmark} title="자본 배치" metric={data.capital_allocation}>
          <div className="flex items-center gap-3">
            {chartData.length > 0 ? (
              <div className="h-20 w-20 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      innerRadius={22}
                      outerRadius={36}
                      paddingAngle={2}
                    >
                      {chartData.map((entry) => (
                        <Cell
                          key={entry.key}
                          fill={ALLOCATION_COLORS[entry.key] || '#94a3b8'}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
                      contentStyle={{ fontSize: 11 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : null}
            <div className="space-y-0.5 text-[11px] text-neutral-600">
              {data.capital_allocation?.profile && (
                <p className="font-bold text-neutral-800">
                  {profileLabels[data.capital_allocation.profile] || data.capital_allocation.profile}
                </p>
              )}
              {chartData.map((d) => (
                <p key={d.key}>
                  <span
                    className="mr-1 inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: ALLOCATION_COLORS[d.key] }}
                  />
                  {d.name}: {d.value.toFixed(1)}%
                </p>
              ))}
            </div>
          </div>
        </MetricCard>
      </div>

      {data.data_years && data.data_years.length > 0 && (
        <p className="text-[10px] text-neutral-400">
          분석 기간: {Math.min(...data.data_years)}~{Math.max(...data.data_years)}년
        </p>
      )}
    </div>
  );
}

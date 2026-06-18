'use client';

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Loader2, BarChart3, Info } from 'lucide-react';
import useSWR from 'swr';
import { fetcher, type FinancialsResponse } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { chartColors } from '@/lib/chart-colors';
import { cn } from '@/lib/cn';

function formatEok(value?: number | null): string {
  if (value == null) return '-';
  return `${formatNumber(value / 100_000_000, 0)}억`;
}

interface Props {
  ticker: string;
}

export default function FinancialsPanel({ ticker }: Props) {
  const { data, isLoading } = useSWR<FinancialsResponse>(
    `/stocks/${ticker}/financials`,
    fetcher,
  );

  if (isLoading) {
    return (
      <div className="card-modern flex items-center justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-xs text-muted">재무 데이터 로딩 중...</span>
      </div>
    );
  }

  if (!data || data.status !== 'ok' || !data.rows?.length) {
    return (
      <div className="card-modern p-6 text-center">
        <Info className="mx-auto mb-2 h-5 w-5 text-muted" strokeWidth={1.5} />
        <p className="text-xs font-medium text-muted">
          {data?.message || '재무 공시 데이터를 수집할 수 없습니다.'}
        </p>
      </div>
    );
  }

  const chartData = data.rows.map((row) => ({
    year: `${row.fiscal_year}`,
    revenue: row.revenue != null ? row.revenue / 100_000_000 : null,
    operating_income: row.operating_income != null ? row.operating_income / 100_000_000 : null,
    operating_margin_pct: row.operating_margin_pct,
  }));

  const recentRows = [...data.rows].slice(-5).reverse();

  return (
    <div className="card-modern p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BarChart3 className="h-4 w-4 text-primary" strokeWidth={1.5} />
          재무 추이
        </h2>
        <div className="flex items-center gap-2">
          {data.source && (
            <span className="rounded-lg bg-surface px-2 py-0.5 text-[10px] font-semibold text-muted">
              {data.source}
            </span>
          )}
          {data.revenue_cagr_3y_pct != null && (
            <span className="rounded-lg bg-sidebar-active px-2 py-0.5 text-[10px] font-semibold text-primary">
              매출 CAGR {formatNumber(data.revenue_cagr_3y_pct, 1)}%
            </span>
          )}
        </div>
      </div>

      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 10, fill: chartColors.axis, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10, fill: chartColors.axis }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}`}
              width={45}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10, fill: chartColors.axis }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
              width={40}
            />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #f0e8f5' }}
              formatter={(value, name) => {
                if (name === '영업이익률') return [`${value}%`, name];
                return [`${value}억`, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar
              yAxisId="left"
              dataKey="revenue"
              name="매출"
              fill={chartColors.series[0]}
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
            <Bar
              yAxisId="left"
              dataKey="operating_income"
              name="영업이익"
              fill={chartColors.series[1]}
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="operating_margin_pct"
              name="영업이익률"
              stroke={chartColors.series[3]}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-surface px-4 pb-3 pt-5 pl-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted">
              <th className="px-3 py-2.5 text-left font-semibold">연도</th>
              <th className="px-3 py-2.5 text-right font-semibold">매출</th>
              <th className="px-3 py-2.5 text-right font-semibold">영업이익</th>
              <th className="px-3 py-2.5 text-right font-semibold">영업이익률</th>
              <th className="px-3 py-2.5 text-right font-semibold">매출 YoY</th>
            </tr>
          </thead>
          <tbody>
            {recentRows.map((row) => (
              <tr key={row.fiscal_year} className="border-t border-border/30">
                <td className="px-3 py-2.5 font-semibold text-foreground">{row.fiscal_year}</td>
                <td className="px-3 py-2.5 text-right text-muted">{formatEok(row.revenue)}</td>
                <td className="px-3 py-2.5 text-right text-muted">{formatEok(row.operating_income)}</td>
                <td className="px-3 py-2.5 text-right text-muted">
                  {row.operating_margin_pct != null
                    ? `${formatNumber(row.operating_margin_pct, 1)}%`
                    : '-'}
                </td>
                <td
                  className={cn(
                    'px-3 py-2.5 text-right font-semibold',
                    (row.revenue_yoy_pct ?? 0) > 0
                      ? 'text-up'
                      : (row.revenue_yoy_pct ?? 0) < 0
                      ? 'text-down'
                      : 'text-muted',
                  )}
                >
                  {row.revenue_yoy_pct != null
                    ? `${row.revenue_yoy_pct > 0 ? '+' : ''}${formatNumber(row.revenue_yoy_pct, 1)}%`
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

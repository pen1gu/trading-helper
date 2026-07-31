'use client';

import React, { useMemo } from 'react';
import {
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
} from 'recharts';
import { chartColors } from '@/lib/chart-colors';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { TechnicalBarPoint, TechnicalSnapshot } from '@/lib/api';

const TOSS_UP = '#F04452';
const TOSS_DOWN = '#3182F6';

interface CandleChartProps {
  data: TechnicalBarPoint[];
  snapshot?: TechnicalSnapshot;
}

const PriceTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: TechnicalBarPoint }> }) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const isUp = data.close_price >= data.open_price;
  const change = data.close_price - data.open_price;
  const changePct = data.open_price ? (change / data.open_price) * 100 : 0;

  return (
    <div className="rounded-xl bg-card/95 p-4 shadow-xl backdrop-blur-md text-xs">
      <p className="mb-2 font-semibold text-muted">{data.trade_date}</p>
      <div className="space-y-2">
        <div className="flex justify-between gap-8">
          <span className="text-muted font-medium">종가</span>
          <span className={cn('font-semibold', isUp ? 'text-up' : 'text-down')}>
            {data.close_price.toLocaleString()} ({changePct >= 0 ? '+' : ''}
            {changePct.toFixed(2)}%)
          </span>
        </div>
        <div className="h-[1px] bg-border" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
          <span className="text-muted">시가</span>
          <span className="text-right font-semibold">{data.open_price.toLocaleString()}</span>
          <span className="text-muted">고가</span>
          <span className="text-right font-semibold">{data.high_price.toLocaleString()}</span>
          <span className="text-muted">저가</span>
          <span className="text-right font-semibold">{data.low_price.toLocaleString()}</span>
          {data.ma20 != null && (
            <>
              <span className="text-muted">MA20</span>
              <span className="text-right font-semibold">{formatNumber(data.ma20, 0)}</span>
            </>
          )}
          {data.rsi14 != null && (
            <>
              <span className="text-muted">RSI</span>
              <span className="text-right font-semibold">{formatNumber(data.rsi14, 1)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default function CandleChart({ data, snapshot }: CandleChartProps) {
  const lineColor = useMemo(() => {
    if (!data?.length) return TOSS_UP;
    return data[data.length - 1].close_price >= data[0].close_price ? TOSS_UP : TOSS_DOWN;
  }, [data]);

  const { minPrice, maxPrice } = useMemo(() => {
    if (!data?.length) return { minPrice: 0, maxPrice: 100 };
    const closes = data.map((d) => d.close_price);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || max * 0.05;
    return {
      minPrice: min - range * 0.08,
      maxPrice: max + range * 0.08,
    };
  }, [data]);

  const volumeData = useMemo(
    () =>
      data.map((d) => ({
        trade_date: d.trade_date,
        volume: d.volume,
        isUp: d.close_price >= d.open_price,
      })),
    [data],
  );

  if (!data?.length) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        차트 데이터가 없습니다.
      </div>
    );
  }

  if (data.length < 2) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center px-4">
        <p className="text-xs font-medium text-muted">
          일봉 데이터가 부족합니다 ({data.length}일)
        </p>
        <p className="text-[10px] text-muted/80">
          추세·이동평균 분석을 위해 최소 2일 이상의 일봉이 필요합니다.
        </p>
      </div>
    );
  }

  const alignmentLabel =
    snapshot?.ma_alignment === 'bullish'
      ? '정배열'
      : snapshot?.ma_alignment === 'bearish'
      ? '역배열'
      : '중립';

  const gradientId = lineColor === TOSS_UP ? 'toss-up-gradient' : 'toss-down-gradient';

  return (
    <div className="flex h-full w-full flex-col gap-2 select-none">
      {snapshot && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          {snapshot.rsi14 != null && (
            <span className="rounded-lg bg-surface px-2 py-0.5 text-[10px] font-semibold text-muted">
              RSI {formatNumber(snapshot.rsi14, 1)}
            </span>
          )}
          {snapshot.vs_ma20_pct != null && (
            <span className="rounded-lg bg-surface px-2 py-0.5 text-[10px] font-semibold text-muted">
              MA20 {snapshot.vs_ma20_pct > 0 ? '+' : ''}
              {formatNumber(snapshot.vs_ma20_pct, 1)}%
            </span>
          )}
          <span className="rounded-lg bg-sidebar-active px-2 py-0.5 text-[10px] font-semibold text-primary">
            {alignmentLabel}
          </span>
          {snapshot.volume_ratio_vs_20d != null && (
            <span className="rounded-lg bg-surface px-2 py-0.5 text-[10px] font-semibold text-muted">
              거래량 {formatNumber(snapshot.volume_ratio_vs_20d, 1)}x
            </span>
          )}
        </div>
      )}

      <div className="min-h-0 flex-[3]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="toss-up-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TOSS_UP} stopOpacity={0.18} />
                <stop offset="100%" stopColor={TOSS_UP} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="toss-down-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TOSS_DOWN} stopOpacity={0.18} />
                <stop offset="100%" stopColor={TOSS_DOWN} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
            <XAxis
              dataKey="trade_date"
              tick={{ fontSize: 9, fill: chartColors.axis, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={[minPrice, maxPrice]}
              tick={{ fontSize: 9, fill: chartColors.axis, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              orientation="right"
              tickFormatter={(v) => v.toLocaleString()}
              width={55}
            />
            <Tooltip content={<PriceTooltip />} cursor={{ stroke: chartColors.grid, strokeDasharray: '4 4' }} />
            <Area
              type="monotone"
              dataKey="close_price"
              stroke="none"
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="close_price"
              stroke={lineColor}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="min-h-0 flex-[1]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={volumeData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
            <XAxis
              dataKey="trade_date"
              tick={{ fontSize: 8, fill: chartColors.axis }}
              axisLine={false}
              tickLine={false}
              minTickGap={50}
            />
            <YAxis
              tick={{ fontSize: 8, fill: chartColors.axis }}
              axisLine={false}
              tickLine={false}
              orientation="right"
              tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`}
              width={45}
            />
            <Bar
              dataKey="volume"
              radius={[1, 1, 0, 0]}
              isAnimationActive={false}
              shape={(props: { x?: number; y?: number; width?: number; height?: number; payload?: { isUp: boolean } }) => {
                const { x = 0, y = 0, width = 0, height = 0, payload } = props;
                const fill = payload?.isUp ? TOSS_UP : TOSS_DOWN;
                return <rect x={x} y={y} width={width} height={height} fill={fill} />;
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

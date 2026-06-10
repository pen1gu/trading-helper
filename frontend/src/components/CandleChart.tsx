'use client';

import React, { useMemo } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

interface BarData {
  trade_date: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume: number;
}

interface CandleChartProps {
  data: BarData[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isUp = data.close_price >= data.open_price;
    const change = data.close_price - data.open_price;
    const changePct = (change / data.open_price) * 100;

    return (
      <div className="rounded-xl border border-neutral-200 bg-white/90 p-4 shadow-xl backdrop-blur-md text-xs">
        <p className="mb-2 font-black text-neutral-400 uppercase">{data.trade_date}</p>
        <div className="space-y-2">
          <div className="flex justify-between gap-8">
            <span className="text-neutral-500 font-bold">종가</span>
            <span className={`font-black ${isUp ? 'text-red-500' : 'text-blue-500'}`}>
              {data.close_price.toLocaleString()}원 ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
            </span>
          </div>
          <div className="h-[1px] bg-neutral-100" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            <span className="text-neutral-400">시가</span>
            <span className="text-right font-bold text-neutral-900">{data.open_price.toLocaleString()}</span>
            <span className="text-neutral-400">고가</span>
            <span className="text-right font-bold text-neutral-900">{data.high_price.toLocaleString()}</span>
            <span className="text-neutral-400">저가</span>
            <span className="text-right font-bold text-neutral-900">{data.low_price.toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function CandleChart({ data }: CandleChartProps) {
  // 전체적인 추세(상승/하락) 판단 (마지막 날 종가 vs 첫 날 시가)
  const isTrendUp = useMemo(() => {
    if (!data || data.length < 2) return true;
    const firstPrice = data[0].close_price;
    const lastPrice = data[data.length - 1].close_price;
    return lastPrice >= firstPrice;
  }, [data]);

  const trendColor = isTrendUp ? '#ef4444' : '#3b82f6'; // red-500, blue-500

  // Y축 자동 스케일링
  const { minPrice, maxPrice } = useMemo(() => {
    if (!data || data.length === 0) return { minPrice: 0, maxPrice: 100 };
    const values = data.map(d => d.close_price);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    return {
      minPrice: min - (range * 0.1),
      maxPrice: max + (range * 0.1)
    };
  }, [data]);

  return (
    <div className="h-[400px] w-full select-none">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart 
          data={data} 
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={trendColor} stopOpacity={0.2}/>
              <stop offset="95%" stopColor={trendColor} stopOpacity={0}/>
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
          
          <XAxis 
            dataKey="trade_date" 
            tick={{ fontSize: 10, fill: '#D4D4D4', fontWeight: 600 }} 
            axisLine={false} 
            tickLine={false}
            minTickGap={50}
          />
          
          <YAxis 
            domain={[minPrice, maxPrice]} 
            tick={{ fontSize: 10, fill: '#D4D4D4', fontWeight: 600 }} 
            axisLine={false} 
            tickLine={false}
            orientation="right"
            tickFormatter={(value) => value.toLocaleString()}
            width={60}
          />
          
          <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ stroke: '#E5E5E5', strokeWidth: 1, strokeDasharray: '5 5' }}
          />

          {/* 메인 가격 선 및 그라데이션 영역 */}
          <Area 
            type="monotone" 
            dataKey="close_price" 
            stroke={trendColor} 
            strokeWidth={4} 
            fillOpacity={1} 
            fill="url(#colorTrend)" 
            isAnimationActive={false}
            activeDot={{ r: 6, strokeWidth: 0, fill: trendColor }}
          />
          
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

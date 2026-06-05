'use client';

import React, { useMemo } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  LineChart,
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
            <span className="text-neutral-500 font-bold">가격</span>
            <span className={`font-black ${isUp ? 'text-red-600' : 'text-blue-600'}`}>
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
  // 토스 스타일: 시고저종 바를 제거하고 깔끔한 선 차트와 이동평균선만 제공
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data.map((d, i) => {
      const ma5 = i >= 4 ? data.slice(i - 4, i + 1).reduce((acc, curr) => acc + curr.close_price, 0) / 5 : null;
      const ma20 = i >= 19 ? data.slice(i - 19, i + 1).reduce((acc, curr) => acc + curr.close_price, 0) / 20 : null;
      
      return {
        ...d,
        ma5,
        ma20,
      };
    });
  }, [data]);

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
        <LineChart 
          data={processedData} 
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
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
            cursor={{ stroke: '#E5E5E5', strokeWidth: 1 }}
          />

          {/* 메인 가격 선 (토스 스타일) */}
          <Line 
            type="monotone" 
            dataKey="close_price" 
            stroke="#171717" 
            strokeWidth={3} 
            dot={false}
            activeDot={{ r: 6, strokeWidth: 0, fill: '#171717' }}
            isAnimationActive={false}
          />
          
          {/* 이동평균선 (보조선) */}
          <Line 
            type="monotone" 
            dataKey="ma5" 
            stroke="#ef4444" 
            dot={false} 
            strokeWidth={1.5} 
            opacity={0.5}
            isAnimationActive={false}
          />
          <Line 
            type="monotone" 
            dataKey="ma20" 
            stroke="#3b82f6" 
            dot={false} 
            strokeWidth={1.5} 
            opacity={0.5}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

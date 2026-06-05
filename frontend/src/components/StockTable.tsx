'use client';

import React from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { formatStockPrice, formatPercent } from '@/lib/format';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Stock {
  id: number;
  ticker: string;
  name: string;
  current_price?: number;
  change_rate: number;
  market_cap: number;
  per: number;
  pbr: number;
  ai_score?: number;
  ai_recommendation?: string;
  ai_analysis?: {
    radar_chart?: {
      profitability: number;
      growth: number;
      valuation: number;
      stability: number;
      momentum: number;
    };
    strengths?: string[];
    weaknesses?: string[];
  };
}

export default function StockTable() {
  const { data, error, isLoading } = useSWR<Stock[]>('/stocks', fetcher);

  const stocks = data ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-900" />
      </div>
    );
  }
  if (error) {
    return <div className="p-12 text-center text-neutral-600">데이터를 불러오는 중 오류가 발생했습니다.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-neutral-500">
        <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-600">
          <tr>
            <th className="px-6 py-4">종목명</th>
            <th className="px-6 py-4">현재가</th>
            <th className="px-6 py-4">등락률</th>
            <th className="px-6 py-4">AI 추천</th>
            <th className="w-28 px-6 py-4" />
          </tr>
        </thead>
        <tbody>
          {stocks.map((stock) => (
            <React.Fragment key={stock.id}>
              <tr className="border-b border-neutral-100 bg-white transition-colors hover:bg-neutral-50">
                <td className="whitespace-nowrap px-6 py-4 font-bold text-neutral-900">
                  {stock.name}{' '}
                  <span className="ml-1 text-xs font-normal text-neutral-400">{stock.ticker}</span>
                </td>
                <td className="px-6 py-4 font-medium whitespace-nowrap">{formatStockPrice(stock.current_price, stock.ticker)}</td>
                <td className={`px-6 py-4 font-bold whitespace-nowrap ${stock.change_rate > 0 ? 'text-red-600' : stock.change_rate < 0 ? 'text-blue-600' : 'text-neutral-400'}`}>
                  {formatPercent(stock.change_rate)}
                </td>
                <td className="px-6 py-4 font-bold text-neutral-600 whitespace-nowrap">
                  {stock.ai_recommendation === 'Long'
                    ? 'Long'
                    : stock.ai_recommendation === 'Short'
                      ? 'Short'
                      : 'Neutral'}
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/stocks/${stock.ticker}`}
                    className="inline-block whitespace-nowrap rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-neutral-700"
                  >
                    상세보기
                  </Link>
                </td>
              </tr>
            </React.Fragment>
          ))}
          {stocks.length === 0 && (
            <tr>
              <td colSpan={8} className="px-6 py-12 text-center text-neutral-400">
                데이터가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

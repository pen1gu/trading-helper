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

interface StockTableProps {
  endpoint?: string;
  emptyMessage?: string;
}

export default function StockTable({
  endpoint = '/stocks',
  emptyMessage = '데이터가 없습니다.',
}: StockTableProps) {
  const { data, error, isLoading } = useSWR<Stock[]>(endpoint, fetcher);

  const stocks = data ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (error) {
    return <div className="p-12 text-center text-muted">데이터를 불러오는 중 오류가 발생했습니다.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-muted">
        <thead className="border-b border-border bg-surface text-xs font-semibold text-muted">
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
              <tr className="border-b border-border/50 bg-card transition-colors hover:bg-sidebar-hover">
                <td className="whitespace-nowrap px-6 py-4 font-semibold text-foreground">
                  {stock.name}{' '}
                  <span className="ml-1 text-xs font-normal text-muted">{stock.ticker}</span>
                </td>
                <td className="px-6 py-4 font-medium whitespace-nowrap">{formatStockPrice(stock.current_price, stock.ticker)}</td>
                <td className={`px-6 py-4 font-semibold whitespace-nowrap ${stock.change_rate > 0 ? 'text-up' : stock.change_rate < 0 ? 'text-down' : 'text-muted'}`}>
                  {formatPercent(stock.change_rate)}
                </td>
                <td className="px-6 py-4 font-semibold text-muted whitespace-nowrap">
                  {stock.ai_recommendation === 'Long'
                    ? 'Long'
                    : stock.ai_recommendation === 'Short'
                      ? 'Short'
                      : 'Neutral'}
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/stocks/${stock.ticker}`}
                    className="inline-block whitespace-nowrap rounded-xl btn-primary px-3 py-1.5 text-xs"
                  >
                    상세보기
                  </Link>
                </td>
              </tr>
            </React.Fragment>
          ))}
          {stocks.length === 0 && (
            <tr>
              <td colSpan={8} className="px-6 py-12 text-center text-muted">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

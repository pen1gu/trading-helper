'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import RadarChartComponent from './RadarChart';

interface Stock {
  id: number;
  ticker: string;
  name: string;
  price: number;
  change_rate: number;
  market_cap: number;
  per: number;
  pbr: number;
  ai_score: number;
  ai_recommendation: string;
  ai_analysis: {
    radar_chart: {
      profitability: number;
      growth: number;
      valuation: number;
      stability: number;
      momentum: number;
    };
    strengths: string[];
    weaknesses: string[];
  };
}

// Fallback Mock Data
const mockStocks: Stock[] = [
  {
    id: 1,
    ticker: '005930',
    name: '삼성전자',
    price: 82000,
    change_rate: 1.5,
    market_cap: 489000000000000,
    per: 15.2,
    pbr: 1.4,
    ai_score: 85,
    ai_recommendation: 'Long',
    ai_analysis: {
      radar_chart: { profitability: 8, growth: 7, valuation: 6, stability: 9, momentum: 8 },
      strengths: ['글로벌 파운드리 수요 증가', '메모리 가격 회복세', '안정적인 현금 흐름'],
      weaknesses: ['환율 리스크', '모바일 수요 둔화 가능성']
    }
  },
  {
    id: 2,
    ticker: 'AAPL',
    name: 'Apple Inc.',
    price: 175.50,
    change_rate: -0.5,
    market_cap: 2700000000000,
    per: 26.5,
    pbr: 38.2,
    ai_score: 75,
    ai_recommendation: 'Neutral',
    ai_analysis: {
      radar_chart: { profitability: 10, growth: 5, valuation: 4, stability: 10, momentum: 6 },
      strengths: ['강력한 생태계 락인 효과', '막대한 자사주 매입', '서비스 부문 고성장'],
      weaknesses: ['중국 내 판매량 감소', 'AI 혁신 지연 우려']
    }
  }
];

export default function StockTable() {
  const { data, error, isLoading } = useSWR<Stock[]>('/stocks', fetcher);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const stocks = data && data.length > 0 ? data : mockStocks;

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" /></div>;
  if (error) return <div className="text-center p-12 text-red-500">데이터를 불러오는 중 오류가 발생했습니다.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-slate-500">
        <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-6 py-3">종목명</th>
            <th className="px-6 py-3">현재가</th>
            <th className="px-6 py-3">등락률</th>
            <th className="px-6 py-3">AI 스코어</th>
            <th className="px-6 py-3">추천</th>
            <th className="px-6 py-3">PER</th>
            <th className="px-6 py-3">PBR</th>
            <th className="px-6 py-3 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((stock) => (
            <React.Fragment key={stock.id}>
              <tr 
                className="bg-white border-b hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => setExpandedId(expandedId === stock.id ? null : stock.id)}
              >
                <td className="px-6 py-4 font-bold text-slate-900 whitespace-nowrap">
                  {stock.name} <span className="text-slate-400 font-normal text-xs ml-1">{stock.ticker}</span>
                </td>
                <td className="px-6 py-4 font-medium">{stock.price.toLocaleString()}</td>
                <td className={`px-6 py-4 font-bold ${stock.change_rate > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                  {stock.change_rate > 0 ? '+' : ''}{stock.change_rate}%
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                    stock.ai_score >= 80 ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                    stock.ai_score >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {stock.ai_score}점
                  </span>
                </td>
                <td className="px-6 py-4 font-bold text-slate-700">
                  {stock.ai_recommendation === 'Long' ? '🚀 Long' : 
                   stock.ai_recommendation === 'Short' ? '📉 Short' : '➖ Neutral'}
                </td>
                <td className="px-6 py-4 text-slate-600">{stock.per || '-'}</td>
                <td className="px-6 py-4 text-slate-600">{stock.pbr || '-'}</td>
                <td className="px-6 py-4 text-slate-400">
                  {expandedId === stock.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </td>
              </tr>
              
              {/* Expanded Area for Radar Chart & Analysis */}
              {expandedId === stock.id && stock.ai_analysis && (
                <tr className="bg-slate-50 border-b border-slate-200">
                  <td colSpan={8} className="px-6 py-6">
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                      
                      {/* Radar Chart */}
                      <div className="w-full md:w-1/3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <h4 className="text-sm font-bold text-slate-800 text-center mb-2">📊 펀더멘털 스코어링</h4>
                        <RadarChartComponent data={stock.ai_analysis.radar_chart} />
                      </div>
                      
                      {/* Text Analysis */}
                      <div className="w-full md:w-2/3 space-y-6">
                        <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm">
                          <h4 className="text-sm font-bold text-blue-700 mb-3 flex items-center">
                            <span className="bg-blue-100 p-1 rounded mr-2">👍</span> 주요 강점 (Strengths)
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {stock.ai_analysis.strengths.map((str, idx) => (
                              <span key={idx} className="bg-slate-100 text-slate-700 text-sm px-3 py-1.5 rounded-lg border border-slate-200 font-medium">
                                #{str}
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        <div className="bg-white p-5 rounded-xl border border-red-100 shadow-sm">
                          <h4 className="text-sm font-bold text-red-700 mb-3 flex items-center">
                            <span className="bg-red-100 p-1 rounded mr-2">👎</span> 주요 약점 (Weaknesses)
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {stock.ai_analysis.weaknesses.map((wk, idx) => (
                              <span key={idx} className="bg-slate-100 text-slate-700 text-sm px-3 py-1.5 rounded-lg border border-slate-200 font-medium">
                                #{wk}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
          {stocks.length === 0 && (
            <tr>
              <td colSpan={8} className="px-6 py-12 text-center text-slate-400">데이터가 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

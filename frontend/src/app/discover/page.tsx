'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { Loader2, TrendingUp, TrendingDown, Info } from 'lucide-react';

interface ScanResult {
  id: number;
  ticker: string;
  name: string;
  price: number;
  change_rate: number;
  ai_score: number;
  ai_recommendation: string;
}

// Fallback Mock Data for Discover
const mockScanResults: ScanResult[] = [
  { id: 1, ticker: 'NVDA', name: 'NVIDIA Corp', price: 920.5, change_rate: 4.2, ai_score: 95, ai_recommendation: 'Long' },
  { id: 2, ticker: '000660', name: 'SK하이닉스', price: 185000, change_rate: 3.8, ai_score: 88, ai_recommendation: 'Long' },
  { id: 3, ticker: 'MSFT', name: 'Microsoft', price: 420.1, change_rate: 1.2, ai_score: 75, ai_recommendation: 'Long' },
  { id: 4, ticker: 'TSLA', name: 'Tesla Inc', price: 165.2, change_rate: -3.5, ai_score: 45, ai_recommendation: 'Short' },
  { id: 5, ticker: '035420', name: 'NAVER', price: 185000, change_rate: -2.1, ai_score: 55, ai_recommendation: 'Short' },
  { id: 6, ticker: 'INTC', name: 'Intel Corp', price: 32.5, change_rate: -4.8, ai_score: 30, ai_recommendation: 'Short' },
];

export default function DiscoverPage() {
  const { data, error, isLoading } = useSWR<ScanResult[]>('/stocks/scan', fetcher);
  
  const scanResults = data && data.length > 0 ? data : mockScanResults;

  // Sorting logic (descending by change_rate as requested in spec)
  const sortedResults = [...scanResults].sort((a, b) => b.change_rate - a.change_rate);
  
  const longs = sortedResults.filter(s => s.ai_recommendation === 'Long');
  const shorts = sortedResults.filter(s => s.ai_recommendation === 'Short');

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" /></div>;
  if (error) return <div className="text-center p-12 text-red-500">데이터를 불러오는 중 오류가 발생했습니다.</div>;

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">AI 종목 탐색</h1>
          <p className="text-slate-500 mt-1">시장 전체 스캔을 통한 롱/숏 (Long/Short) 모멘텀 추천</p>
        </div>
        <div className="bg-blue-50 text-blue-700 text-xs px-3 py-2 rounded-lg flex items-center border border-blue-100">
          <Info size={14} className="mr-1" /> 등락률(%) 내림차순 정렬됨
        </div>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Long Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-blue-50 p-4 border-b border-blue-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-blue-800 flex items-center">
              <TrendingUp className="mr-2" /> 🚀 강력 매수 (Long)
            </h2>
            <span className="bg-blue-200 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">{longs.length} 종목</span>
          </div>
          <div className="divide-y divide-slate-100">
            {longs.map((stock) => (
              <div key={stock.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-900">{stock.name} <span className="text-xs text-slate-400 font-normal ml-1">{stock.ticker}</span></h3>
                  <p className="text-sm text-slate-500 mt-1">AI 스코어: <span className="font-semibold text-blue-600">{stock.ai_score}점</span></p>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-800">{stock.price.toLocaleString()}</div>
                  <div className={`text-sm font-bold mt-1 ${stock.change_rate > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                    {stock.change_rate > 0 ? '+' : ''}{stock.change_rate}%
                  </div>
                </div>
              </div>
            ))}
            {longs.length === 0 && <div className="p-8 text-center text-slate-400">추천 종목이 없습니다.</div>}
          </div>
        </div>

        {/* Short Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-red-50 p-4 border-b border-red-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-red-800 flex items-center">
              <TrendingDown className="mr-2" /> 📉 주의 및 매도 (Short)
            </h2>
            <span className="bg-red-200 text-red-800 text-xs font-bold px-2 py-1 rounded-full">{shorts.length} 종목</span>
          </div>
          <div className="divide-y divide-slate-100">
            {shorts.map((stock) => (
              <div key={stock.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-900">{stock.name} <span className="text-xs text-slate-400 font-normal ml-1">{stock.ticker}</span></h3>
                  <p className="text-sm text-slate-500 mt-1">AI 스코어: <span className="font-semibold text-red-600">{stock.ai_score}점</span></p>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-800">{stock.price.toLocaleString()}</div>
                  <div className={`text-sm font-bold mt-1 ${stock.change_rate > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                    {stock.change_rate > 0 ? '+' : ''}{stock.change_rate}%
                  </div>
                </div>
              </div>
            ))}
            {shorts.length === 0 && <div className="p-8 text-center text-slate-400">추천 종목이 없습니다.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

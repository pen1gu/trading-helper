'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import NewsCard from '@/components/NewsCard';
import { Loader2 } from 'lucide-react';

// Fallback mock data in case API is empty
const mockNews = [
  {
    id: 1,
    title: "엔비디아, 차세대 AI 칩 '루빈' 발표... 시장 반응 '열광'",
    summary: "엔비디아가 블랙웰의 후속인 차세대 AI 칩 '루빈' 아키텍처를 전격 공개했습니다. 시장 전문가들은 AI 인프라 수요가 지속될 것으로 전망하며 강력한 매수세를 보이고 있습니다. 관련 밸류체인 전반에 걸친 수혜가 예상됩니다.",
    content: "...",
    url: "#",
    source: "블룸버그",
    published_at: new Date().toISOString(),
    sentiment_score: 85,
    hot_keywords: ["엔비디아", "AI칩", "루빈", "수혜주"]
  },
  {
    id: 2,
    title: "파월 연준 의장, 금리 인하 신중론 재확인... '데이터 더 봐야'",
    summary: "제롬 파월 연준 의장이 최근 인플레이션 지표가 긍정적이지만 금리 인하를 서두르지 않겠다고 밝혔습니다. 시장은 올해 1~2회 인하를 예상하고 있으나, 불확실성이 여전하여 증시의 변동성이 확대될 수 있습니다.",
    content: "...",
    url: "#",
    source: "WSJ",
    published_at: new Date(Date.now() - 3600000).toISOString(),
    sentiment_score: 45,
    hot_keywords: ["연준", "금리인하", "파월", "인플레이션"]
  },
  {
    id: 3,
    title: "테슬라, 중국 내 자율주행(FSD) 출시 임박... 주가 반등 시도",
    summary: "테슬라가 중국 당국과 데이터 보안 문제를 해결하고 FSD(완전 자율주행) 시스템 출시를 앞두고 있습니다. 이는 중국 내 판매 부진을 타개할 핵심 모멘텀으로 작용할 전망이며, 주가 반등의 신호탄이 될지 주목됩니다.",
    content: "...",
    url: "#",
    source: "로이터",
    published_at: new Date(Date.now() - 7200000).toISOString(),
    sentiment_score: 72,
    hot_keywords: ["테슬라", "FSD", "중국시장", "자율주행"]
  }
];

export default function NewsPage() {
  const { data, error, isLoading } = useSWR('/news', fetcher);
  
  const newsList = data && data.length > 0 ? data : mockNews;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">뉴스 허브</h1>
        <p className="text-slate-500 mt-1">AI가 분석한 실시간 마켓 센티멘트 및 주요 뉴스</p>
      </header>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-800">마켓 센티멘트 게이지</h2>
          <span className="text-2xl font-bold text-blue-600">65<span className="text-sm text-slate-500 font-medium">/100</span></span>
        </div>
        <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex">
          <div className="bg-blue-500 w-[65%] transition-all duration-1000"></div>
          <div className="bg-red-400 w-[35%] transition-all duration-1000"></div>
        </div>
        <div className="flex justify-between mt-2 text-xs font-medium text-slate-500">
          <span className="text-blue-600 font-bold">긍정 우위</span>
          <span>부정 (35%)</span>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" /></div>
        ) : error ? (
          <div className="text-center p-12 text-red-500">뉴스를 불러오는 중 오류가 발생했습니다.</div>
        ) : (
          newsList.map((news: any) => (
            <NewsCard key={news.id} news={news} />
          ))
        )}
      </div>
    </div>
  );
}

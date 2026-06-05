'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import NewsCard from '@/components/NewsCard';
import { Loader2 } from 'lucide-react';

const mockNews = [
  {
    id: 1,
    title: "엔비디아, 차세대 AI 칩 '루빈' 발표... 시장 반응 '열광'",
    summary:
      "엔비디아가 블랙웰의 후속인 차세대 AI 칩 '루빈' 아키텍처를 전격 공개했습니다. 시장 전문가들은 AI 인프라 수요가 지속될 것으로 전망하며 강력한 매수세를 보이고 있습니다.",
    content: "...",
    url: "#",
    source: "블룸버그",
    published_at: new Date().toISOString(),
    sentiment_score: 85,
    hot_keywords: ["엔비디아", "AI칩", "루빈", "수혜주"],
  },
  {
    id: 2,
    title: "파월 연준 의장, 금리 인하 신중론 재확인... '데이터 더 봐야'",
    summary:
      "제롬 파월 연준 의장이 최근 인플레이션 지표가 긍정적이지만 금리 인하를 서두르지 않겠다고 밝혔습니다.",
    content: "...",
    url: "#",
    source: "WSJ",
    published_at: new Date(Date.now() - 3600000).toISOString(),
    sentiment_score: 45,
    hot_keywords: ["연준", "금리인하", "파월", "인플레이션"],
  },
  {
    id: 3,
    title: "테슬라, 중국 내 자율주행(FSD) 출시 임박... 주가 반등 시도",
    summary:
      "테슬라가 중국 당국과 데이터 보안 문제를 해결하고 FSD 시스템 출시를 앞두고 있습니다.",
    content: "...",
    url: "#",
    source: "로이터",
    published_at: new Date(Date.now() - 7200000).toISOString(),
    sentiment_score: 72,
    hot_keywords: ["테슬라", "FSD", "중국시장", "자율주행"],
  },
];

export default function NewsPage() {
  const { data, error, isLoading } = useSWR('/news', fetcher);
  const newsList = data && data.length > 0 ? data : mockNews;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">뉴스 허브</h1>
        <p className="mt-1 text-sm text-neutral-500">AI가 분석한 실시간 마켓 센티멘트 및 주요 뉴스</p>
      </header>

      <div className="card-modern p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">마켓 센티멘트 게이지</h2>
          <span className="text-2xl font-bold text-neutral-900">
            65<span className="text-sm font-medium text-neutral-500">/100</span>
          </span>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-neutral-100">
          <div className="w-[65%] rounded-l-full bg-neutral-900 transition-all duration-1000" />
          <div className="w-[35%] bg-neutral-300" />
        </div>
        <div className="mt-2 flex justify-between text-xs font-medium text-neutral-500">
          <span className="font-bold text-neutral-900">긍정 우위</span>
          <span>부정 (35%)</span>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-neutral-900" />
          </div>
        ) : error ? (
          <div className="p-12 text-center text-neutral-600">뉴스를 불러오는 중 오류가 발생했습니다.</div>
        ) : (
          newsList.map((news: (typeof mockNews)[0]) => <NewsCard key={news.id} news={news} />)
        )}
      </div>
    </div>
  );
}

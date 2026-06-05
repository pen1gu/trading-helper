'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface NewsCardProps {
  news: {
    id: number;
    title: string;
    summary: string;
    content: string;
    url: string;
    source: string;
    published_at: string;
    sentiment_score: number;
    hot_keywords: string[];
  };
}

export default function NewsCard({ news }: NewsCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getSentimentStyle = (score: number) => {
    if (score >= 70) return 'bg-neutral-900 text-white border-neutral-900';
    if (score <= 40) return 'bg-neutral-200 text-neutral-600 border-neutral-300';
    return 'bg-neutral-100 text-neutral-600 border-neutral-200';
  };

  return (
    <div className="card-modern overflow-hidden transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
      <div
        className="flex cursor-pointer items-start justify-between gap-4 p-5"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-bold ${getSentimentStyle(news.sentiment_score)}`}
            >
              {news.sentiment_score}점
            </span>
            <span className="text-xs font-medium text-neutral-400">
              {news.source} •{' '}
              {new Date(news.published_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <h3 className="text-lg font-semibold leading-tight text-neutral-900">{news.title}</h3>
        </div>
        <div className="mt-1 text-neutral-400">
          {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-neutral-100 bg-neutral-50 px-5 pb-5">
          <div className="space-y-4 pt-4">
            <div>
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-neutral-500">AI 3줄 요약</h4>
              <p className="text-sm font-medium leading-relaxed text-neutral-600">
                {news.summary || '요약 정보가 없습니다.'}
              </p>
            </div>

            {news.hot_keywords && news.hot_keywords.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-400">핫 키워드</h4>
                <div className="flex flex-wrap gap-2">
                  {news.hot_keywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-600"
                    >
                      #{kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <a
                href={news.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-xs font-semibold text-neutral-900 underline-offset-2 transition-colors hover:underline"
              >
                원문 보기 <ExternalLink size={14} className="ml-1" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

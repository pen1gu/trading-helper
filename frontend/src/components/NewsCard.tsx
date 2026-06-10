'use client';

import { ExternalLink, Clock, Hash } from 'lucide-react';
import { formatDate } from '@/lib/format';

interface NewsCardProps {
  news: {
    id: number;
    title: string;
    summary?: string | null;
    content?: string | null;
    url: string;
    source: string;
    published_at: string;
    sentiment_score?: number | null;
    hot_keywords?: string[] | null;
  };
}

export default function NewsCard({ news }: NewsCardProps) {
  const getSentimentStyle = (score: number) => {
    if (score >= 70) return 'text-indigo-600 bg-indigo-50';
    if (score <= 40) return 'text-slate-500 bg-slate-100';
    return 'text-slate-700 bg-white border border-slate-200';
  };

  return (
    <div className="group relative flex flex-col rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.04)] transition-all hover:border-indigo-200 hover:shadow-[0_8px_32px_-4px_rgba(79,70,229,0.1)] hover:-translate-y-1">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{news.source}</span>
          <div className="h-1 w-1 rounded-full bg-slate-200" />
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
            <Clock size={10} />
            <span>{formatDate(news.published_at, 'YYYY-MM-DD HH:mm')}</span>
          </div>
        </div>
        
        {news.sentiment_score != null && (
          <div className={`rounded-lg px-2 py-0.5 text-[10px] font-black ${getSentimentStyle(news.sentiment_score)}`}>
            {news.sentiment_score}pt
          </div>
        )}
      </div>

      <a 
        href={news.url} 
        target="_blank" 
        rel="noreferrer"
        className="mb-6 block"
      >
        <h3 className="text-lg font-bold leading-snug text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
          {news.title}
        </h3>
      </a>

      <div className="mt-auto flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1.5">
          {news.hot_keywords?.slice(0, 3).map((kw, idx) => (
            <span
              key={idx}
              className="flex items-center gap-0.5 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500"
            >
              <Hash size={8} className="text-slate-300" />
              {kw}
            </span>
          ))}
        </div>
        
        <a
          href={news.url}
          target="_blank"
          rel="noreferrer"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-all hover:bg-indigo-600 hover:text-white"
        >
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}

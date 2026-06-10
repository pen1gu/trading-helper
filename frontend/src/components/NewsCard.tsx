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
    if (score >= 70) return 'text-primary bg-sidebar-active';
    if (score <= 40) return 'text-muted bg-surface';
    return 'text-foreground bg-surface';
  };

  return (
    <div className="group relative flex flex-col rounded-3xl bg-card p-6 shadow-[var(--shadow-soft)] transition-all hover:shadow-[var(--shadow-card)] hover:-translate-y-0.5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-muted">{news.source}</span>
          <div className="h-1 w-1 rounded-full bg-border" />
          <div className="flex items-center gap-1 text-[10px] font-medium text-muted">
            <Clock size={10} strokeWidth={1.5} />
            <span>{formatDate(news.published_at, 'YYYY-MM-DD HH:mm')}</span>
          </div>
        </div>

        {news.sentiment_score != null && (
          <div className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold ${getSentimentStyle(news.sentiment_score)}`}>
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
        <h3 className="text-lg font-semibold leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
          {news.title}
        </h3>
      </a>

      <div className="mt-auto flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1.5">
          {news.hot_keywords?.slice(0, 3).map((kw, idx) => (
            <span
              key={idx}
              className="flex items-center gap-0.5 rounded-full bg-surface px-2.5 py-1 text-[10px] font-medium text-muted"
            >
              <Hash size={8} className="text-border-dark" />
              {kw}
            </span>
          ))}
        </div>

        <a
          href={news.url}
          target="_blank"
          rel="noreferrer"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-muted transition-all hover:bg-primary hover:text-white"
        >
          <ExternalLink size={14} strokeWidth={1.5} />
        </a>
      </div>
    </div>
  );
}

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

  const getSentimentColor = (score: number) => {
    if (score >= 70) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (score <= 40) return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:border-blue-300 transition-colors">
      <div 
        className="p-5 cursor-pointer flex justify-between items-start gap-4"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getSentimentColor(news.sentiment_score)}`}>
              {news.sentiment_score}점
            </span>
            <span className="text-xs text-slate-500 font-medium">{news.source} • {new Date(news.published_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 leading-tight">
            {news.title}
          </h3>
        </div>
        <div className="text-slate-400 mt-1">
          {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      {isOpen && (
        <div className="px-5 pb-5 border-t border-slate-100 bg-slate-50">
          <div className="pt-4 space-y-4">
            <div>
              <h4 className="text-xs font-bold text-blue-600 mb-1 uppercase tracking-wider">AI 3줄 요약</h4>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">
                {news.summary || '요약 정보가 없습니다.'}
              </p>
            </div>
            
            {news.hot_keywords && news.hot_keywords.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">핫 키워드</h4>
                <div className="flex flex-wrap gap-2">
                  {news.hot_keywords.map((kw, idx) => (
                    <span key={idx} className="text-xs bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded-md shadow-sm">
                      #{kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <div className="pt-2 flex justify-end">
               <a href={news.url} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                 원문 보기 <ExternalLink size={14} className="ml-1" />
               </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

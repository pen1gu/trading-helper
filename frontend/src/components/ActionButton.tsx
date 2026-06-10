'use client';

import { useState } from 'react';
import { mutate } from 'swr';
import { Database, Loader2, CheckCircle2, Newspaper, AlertCircle, Clock } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

interface ActionButtonProps {
  type: 'market' | 'news';
  lastUpdatedAt?: string | Date | null;
}

export default function ActionButton({ type, lastUpdatedAt }: ActionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');

  const isMarket = type === 'market';

  const handleAction = async () => {
    if (loading) return;

    setLoading(true);
    setStatus('running');
    setProgress(0);
    setMessage(isMarket ? '시장 데이터 수집 중...' : '뉴스 데이터 수집 중...');

    const eventSource = new EventSource(`${API_BASE_URL}/report/collect-stream?target=${type}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data.progress);
      setMessage(data.message);

      if (data.status === 'done') {
        finishAction();
        eventSource.close();
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE Error:', err);
      failAction(isMarket ? '시장 데이터 수집 중 오류가 발생했습니다.' : '뉴스 데이터 수집 중 오류가 발생했습니다.');
      eventSource.close();
    };
  };

  const finishAction = () => {
    setStatus('done');
    setLoading(false);

    mutate('/report/daily');
    if (type === 'news') mutate('/news');
    mutate('/stocks');
    mutate('/stocks/scan');

    setTimeout(() => {
      setStatus('idle');
      setMessage('');
      setProgress(0);
    }, 5000);
  };

  const failAction = (msg: string) => {
    setMessage(msg);
    setLoading(false);
    setStatus('error');
    setTimeout(() => {
      setStatus('idle');
      setMessage('');
    }, 5000);
  };

  const getButtonStyles = () => {
    if (status === 'error') return 'bg-up text-white shadow-lg shadow-[#fecaca]';
    if (status === 'done') return 'bg-[#10b981] text-white shadow-lg shadow-[#a7f3d0]';

    if (isMarket) {
      return 'bg-[#60a5fa] text-white hover:bg-[#3b82f6] shadow-lg shadow-[#bfdbfe] disabled:bg-[#e0f2fe] disabled:text-[#93c5fd]';
    } else {
      return 'bg-[#fbbf24] text-white hover:bg-[#f59e0b] shadow-lg shadow-[#fde68a] disabled:bg-[#fffbeb] disabled:text-[#fcd34d]';
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleAction}
        disabled={loading}
        className={cn(
          'relative flex min-w-[180px] items-center justify-center gap-2 overflow-hidden rounded-2xl px-6 py-3 text-sm font-semibold transition-all',
          getButtonStyles()
        )}
      >
        {loading && (
          <div
            className="absolute left-0 top-0 h-full bg-white/25 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        )}

        <span className="relative flex items-center gap-2">
          {status === 'done' ? (
            <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
          ) : status === 'error' ? (
            <AlertCircle className="h-4 w-4" strokeWidth={1.5} />
          ) : loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isMarket ? (
            <Database className="h-4 w-4" strokeWidth={1.5} />
          ) : (
            <Newspaper className="h-4 w-4" strokeWidth={1.5} />
          )}

          {status === 'done'
            ? '수집 완료'
            : status === 'error'
            ? '오류 발생'
            : loading
            ? `${progress}%`
            : (isMarket ? '주식 데이터 수집' : '뉴스 데이터 수집')}
        </span>
      </button>

      <div className="flex flex-col items-center gap-1">
        {lastUpdatedAt ? (
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted">
            <Clock size={10} strokeWidth={1.5} />
            <span>최근 업데이트: {formatDate(lastUpdatedAt, 'HH:mm:ss')}</span>
          </div>
        ) : (
          <div className="text-[10px] font-medium text-border-dark">데이터 수집 이력 없음</div>
        )}

        {message && (
          <p className={cn(
            'text-[10px] font-semibold transition-all text-center max-w-[180px] truncate',
            status === 'done' ? 'text-[#059669]' : status === 'error' ? 'text-up' : 'text-muted'
          )}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

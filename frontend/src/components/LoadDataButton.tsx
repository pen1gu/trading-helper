'use client';

import { useState, useEffect } from 'react';
import { Database, Loader2, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

export default function LoadDataButton() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'collecting' | 'done'>('idle');

  const handleLoadData = () => {
    if (loading) return;

    setLoading(true);
    setStatus('collecting');
    setProgress(0);
    setMessage('데이터 수집 준비 중...');

    // SSE 연결 시작
    const eventSource = new EventSource(`${API_BASE_URL}/report/collect-stream`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data.progress);
      setMessage(data.message);

      if (data.status === 'done') {
        setStatus('done');
        setLoading(false);
        eventSource.close();
        
        // 3초 후 초기 상태로 복구
        setTimeout(() => {
          setStatus('idle');
          setMessage('');
          setProgress(0);
        }, 3000);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE Error:', err);
      setMessage('데이터 수집 중 오류가 발생했습니다.');
      setLoading(false);
      setStatus('idle');
      eventSource.close();
    };
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleLoadData}
        disabled={loading}
        className={`relative flex items-center gap-2 overflow-hidden rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${
          status === 'done'
            ? 'bg-green-600 text-white'
            : 'bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500'
        }`}
      >
        {/* 프로그레스바 배경 */}
        {loading && (
          <div 
            className="absolute left-0 top-0 h-full bg-white/20 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        )}
        
        <span className="relative flex items-center gap-2">
          {status === 'done' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Database className="h-4 w-4" />
          )}
          {status === 'done' ? '수집 완료' : loading ? `${progress}% 수집 중...` : '데이터 불러오기'}
        </span>
      </button>
      
      {message && (
        <p className={`text-[10px] font-medium transition-all ${
          status === 'done' ? 'text-green-600' : 'text-neutral-400'
        }`}>
          {message}
        </p>
      )}
    </div>
  );
}

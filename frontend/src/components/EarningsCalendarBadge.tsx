'use client';

import { Calendar, Loader2 } from 'lucide-react';
import useSWR from 'swr';
import { fetcher, type EarningsCalendarResponse } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

interface Props {
  ticker: string;
}

export default function EarningsCalendarBadge({ ticker }: Props) {
  const { data, isLoading } = useSWR<EarningsCalendarResponse>(
    `/stocks/${ticker}/earnings-calendar`,
    fetcher,
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-1 py-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-[11px] text-muted">실적 일정 확인 중...</span>
      </div>
    );
  }

  if (!data || data.status === 'unsupported' || data.status === 'unavailable') {
    return null;
  }

  const days = data.next_earnings_days;
  const hasUpcoming = days != null && days >= 0;

  return (
    <div className="flex flex-wrap items-center gap-3 px-1">
      {hasUpcoming && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-2xl border-2 px-4 py-2.5 shadow-[var(--shadow-soft)]',
            days <= 7
              ? 'border-[#fcd34d] bg-[#fffbeb]'
              : 'border-border bg-card',
          )}
        >
          <Calendar className="h-4 w-4 text-primary" strokeWidth={1.5} />
          <div>
            <p className="text-[10px] font-semibold text-muted">다음 실적 발표</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">
                D{days === 0 ? '-Day' : `-${days}`}
              </span>
              {data.next_earnings_date && (
                <span className="text-[10px] text-muted">
                  ({formatDate(data.next_earnings_date, 'YYYY-MM-DD')})
                </span>
              )}
              {data.confidence && (
                <span className="rounded-md bg-surface px-1.5 py-0.5 text-[9px] font-semibold text-muted">
                  {data.confidence}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {data.last_earnings_days_ago != null && (
        <div className="flex items-center gap-2 rounded-2xl bg-surface px-4 py-2.5">
          <span className="text-[10px] font-semibold text-muted">최근 실적</span>
          <span className="text-xs font-bold text-foreground">
            {data.last_earnings_days_ago}일 전
          </span>
          {data.last_earnings_date && (
            <span className="text-[10px] text-muted">
              ({formatDate(data.last_earnings_date, 'YYYY-MM-DD')})
            </span>
          )}
        </div>
      )}

      {!hasUpcoming && data.last_earnings_days_ago == null && data.message && (
        <p className="text-[11px] text-muted">{data.message}</p>
      )}
    </div>
  );
}

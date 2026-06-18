'use client';

import { Loader2, FileText, ExternalLink, Info } from 'lucide-react';
import useSWR from 'swr';
import { fetcher, type DisclosuresResponse } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  earnings: { label: '실적', color: 'bg-sidebar-active text-primary' },
  dividend: { label: '배당', color: 'bg-[#d1fae5] text-[#047857]' },
  capital: { label: '자본', color: 'bg-[#fffbeb] text-[#b45309]' },
  mna: { label: 'M&A', color: 'bg-[#e0f2fe] text-[#2563eb]' },
  other: { label: '기타', color: 'bg-surface text-muted' },
};

interface Props {
  ticker: string;
}

export default function DisclosurePanel({ ticker }: Props) {
  const { data, isLoading } = useSWR<DisclosuresResponse>(
    `/stocks/${ticker}/disclosures?limit=20`,
    fetcher,
  );

  if (isLoading) {
    return (
      <div className="card-modern flex items-center justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-xs text-muted">공시 데이터 로딩 중...</span>
      </div>
    );
  }

  if (!data || data.status === 'unsupported') {
    return (
      <div className="card-modern p-6 text-center">
        <Info className="mx-auto mb-2 h-5 w-5 text-muted" strokeWidth={1.5} />
        <p className="text-xs font-medium text-muted">
          {data?.message || '국내 공시(DART)는 한국 종목만 지원합니다.'}
        </p>
      </div>
    );
  }

  if (!data.items?.length) {
    return (
      <div className="card-modern p-6 text-center">
        <FileText className="mx-auto mb-2 h-5 w-5 text-muted" strokeWidth={1.5} />
        <p className="text-xs font-medium text-muted">최근 90일 공시가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="card-modern p-6 space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <FileText className="h-4 w-4 text-primary" strokeWidth={1.5} />
        최근 공시 (DART)
      </h2>

      <div className="space-y-2">
        {data.items.map((item) => {
          const typeMeta = TYPE_LABELS[item.report_type] ?? TYPE_LABELS.other;
          return (
            <div
              key={item.rcept_no}
              className="flex items-start justify-between gap-3 rounded-2xl bg-surface p-4 transition-colors hover:bg-sidebar-active/40"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'rounded-lg px-2 py-0.5 text-[10px] font-semibold',
                      typeMeta.color,
                    )}
                  >
                    {typeMeta.label}
                  </span>
                  <span className="text-[10px] font-medium text-muted">
                    {formatDate(item.rcept_dt, 'YYYY-MM-DD')}
                  </span>
                </div>
                <p className="text-xs font-semibold text-foreground line-clamp-2">
                  {item.report_nm}
                </p>
                {item.summary && (
                  <p className="mt-1 text-[10px] text-muted line-clamp-1">{item.summary}</p>
                )}
              </div>
              {item.dart_url && (
                <a
                  href={item.dart_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card text-muted transition-all hover:bg-primary hover:text-white"
                >
                  <ExternalLink size={14} strokeWidth={1.5} />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

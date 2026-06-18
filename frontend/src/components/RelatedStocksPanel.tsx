'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { fetcher } from '@/lib/api';
import { formatPercent, formatStockPrice } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Link2 } from 'lucide-react';

const PREVIEW_COUNT = 5;
const MAX_VISIBLE = 10;

export interface RelatedStockItem {
  ticker: string;
  name: string;
  current_price?: number;
  change_rate?: number;
  ai_score?: number;
  relation_type: 'competitor' | 'theme' | 'peer';
  relation_reason: string;
}

interface RelatedStocksResponse {
  ticker: string;
  items: RelatedStockItem[];
  total: number;
}

const RELATION_LABELS: Record<RelatedStockItem['relation_type'], string> = {
  competitor: '경쟁사',
  theme: '테마',
  peer: '유사',
};

interface RelatedStocksPanelProps {
  ticker: string;
}

export default function RelatedStocksPanel({ ticker }: RelatedStocksPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useSWR<RelatedStocksResponse>(
    `/stocks/${ticker}/related`,
    fetcher,
  );

  const items = data?.items ?? [];
  const capped = items.slice(0, MAX_VISIBLE);
  const visible = expanded ? capped : capped.slice(0, PREVIEW_COUNT);
  const canExpand = capped.length > PREVIEW_COUNT;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary">
          <Link2 className="h-3 w-3" />
          연관주
        </p>
        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] font-semibold text-primary hover:underline"
          >
            {expanded ? '접기' : `더보기 (최대 ${Math.min(MAX_VISIBLE, capped.length)}건)`}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-xl border border-border/50 bg-surface/50"
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-border/50 bg-surface/50 p-3 text-[10px] text-muted">
          연관 종목이 없습니다.
        </p>
      ) : (
        <div className="space-y-1.5">
          {visible.map((item) => (
            <Link
              key={item.ticker}
              href={`/stocks/${item.ticker}`}
              className="group flex items-start justify-between gap-2 rounded-xl border border-border/50 bg-surface/50 px-3 py-2 transition-colors hover:border-primary/30 hover:bg-surface"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[11px] font-semibold text-foreground group-hover:text-primary">
                    {item.name}
                  </span>
                  <span className="shrink-0 rounded px-1 py-0.5 text-[8px] font-bold uppercase text-muted bg-card">
                    {RELATION_LABELS[item.relation_type]}
                  </span>
                </div>
                <p className="truncate text-[9px] text-muted">{item.relation_reason}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-semibold text-foreground">
                  {formatStockPrice(item.current_price, item.ticker)}
                </p>
                <p
                  className={cn(
                    'text-[10px] font-bold',
                    (item.change_rate ?? 0) > 0
                      ? 'text-up'
                      : (item.change_rate ?? 0) < 0
                        ? 'text-down'
                        : 'text-muted',
                  )}
                >
                  {formatPercent(item.change_rate)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

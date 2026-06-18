'use client';

import { ExternalLink, Clock } from 'lucide-react';

interface DisclosureCardProps {
  item: {
    rcept_no: string;
    report_nm: string;
    rcept_dt: string;
    dart_url?: string | null;
  };
  typeLabel: string;
}

export default function DisclosureCard({ item, typeLabel }: DisclosureCardProps) {
  const title = (
    <h3 className="text-lg font-semibold leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
      {item.report_nm}
    </h3>
  );

  return (
    <div className="group relative flex flex-col rounded-3xl bg-card p-6 shadow-[var(--shadow-soft)] transition-all hover:shadow-[var(--shadow-card)] hover:-translate-y-0.5">
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-full bg-surface px-2.5 py-1 text-[10px] font-medium text-muted">
          {typeLabel}
        </span>
        <div className="h-1 w-1 rounded-full bg-border" />
        <div className="flex items-center gap-1 text-[10px] font-medium text-muted">
          <Clock size={10} strokeWidth={1.5} />
          <span>{item.rcept_dt.substring(0, 10)}</span>
        </div>
      </div>

      {item.dart_url ? (
        <a href={item.dart_url} target="_blank" rel="noreferrer" className="mb-6 block">
          {title}
        </a>
      ) : (
        <div className="mb-6">{title}</div>
      )}

      {item.dart_url && (
        <div className="mt-auto flex justify-end">
          <a
            href={item.dart_url}
            target="_blank"
            rel="noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-muted transition-all hover:bg-primary hover:text-white"
          >
            <ExternalLink size={14} strokeWidth={1.5} />
          </a>
        </div>
      )}
    </div>
  );
}

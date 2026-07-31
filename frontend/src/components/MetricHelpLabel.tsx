'use client';

import { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { METRIC_DEFINITIONS } from '@/lib/metric-definitions';

interface Props {
  label: string;
}

export default function MetricHelpLabel({ label }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const description = METRIC_DEFINITIONS[label];

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative mb-1 inline-flex items-center gap-1">
      <p className="text-sm font-bold uppercase text-primary/80">{label}</p>
      {description && (
        <>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="inline-flex shrink-0 rounded-full text-primary/50 transition-colors hover:text-primary focus:text-primary focus:outline-none"
            aria-label={`${label} 설명`}
            aria-expanded={open}
          >
            <Info className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          {open && (
            <div
              role="tooltip"
              className="absolute left-0 top-full z-50 mt-1 w-52 rounded-xl border border-border bg-card px-3 py-2 text-[11px] font-medium leading-relaxed text-muted shadow-[var(--shadow-soft)]"
            >
              {description}
            </div>
          )}
        </>
      )}
    </div>
  );
}

'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import DailyReportSection, {
  DailyReport,
  MacroTicker,
} from '@/components/DailyReportSection';

export default function Home() {
  const { data: report } = useSWR<DailyReport>('/report/daily', fetcher);

  return (
    <div className="space-y-10">
      <div className="border-b border-slate-100 pb-10">
        <div>
          <h1 className="text-5xl font-black tracking-tighter text-slate-900">Dashboard</h1>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-1.5 w-12 rounded-full bg-indigo-600" />
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Intelligence Terminal</p>
          </div>
        </div>
      </div>

      <MacroTicker indices={report?.indices ?? []} />

      <DailyReportSection />
    </div>
  );
}

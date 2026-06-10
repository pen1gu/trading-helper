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
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted mb-1">오늘의 시장</p>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">Dashboard</h1>
      </div>

      <MacroTicker indices={report?.indices ?? []} />

      <DailyReportSection />
    </div>
  );
}

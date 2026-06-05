'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import LoadDataButton from '@/components/LoadDataButton';
import DailyReportSection, {
  DailyReport,
  MacroTicker,
} from '@/components/DailyReportSection';

export default function Home() {
  const { data: report } = useSWR<DailyReport>('/report/daily', fetcher);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">대시보드</h1>
          <p className="mt-1 text-sm text-neutral-500">
            페이지를 열면 DB 저장 데이터를 조회합니다. 상단 버튼은 시세·뉴스 적재만,
            우측 패널은 Gemini 리포트 작성만 실행합니다.
          </p>
        </div>
        <LoadDataButton />
      </div>

      <MacroTicker indices={report?.indices ?? []} />

      <DailyReportSection />
    </div>
  );
}

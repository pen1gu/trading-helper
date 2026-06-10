'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import DataCollectPanel, { CollectStatus } from '@/components/DataCollectPanel';
import { HardDriveDownload } from 'lucide-react';

export default function DataLoadingPage() {
  const { data: status, error } = useSWR<CollectStatus>('/report/collect-status', fetcher, {
    refreshInterval: 30000,
  });

  return (
    <div className="space-y-10">
      <div className="border-b border-slate-100 pb-10">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
            <HardDriveDownload className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-slate-900">데이터 로딩</h1>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
              Collection Control Center
            </p>
          </div>
        </div>
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-slate-500">
          시세·뉴스·재무 분석·AI 리포트 작성을 이 페이지에서 개별 실행할 수 있습니다.
          시세 수집과 재무 분석은 분리되어 있으며, 재무 분석은 필요할 때만 실행하세요.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          수집 현황을 불러오지 못했습니다. 백엔드 서버가 실행 중인지 확인해주세요.
        </div>
      )}

      <DataCollectPanel status={status} />
    </div>
  );
}

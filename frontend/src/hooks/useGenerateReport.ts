'use client';

import { useCallback, useState } from 'react';
import { useSWRConfig } from 'swr';
import { generateReport } from '@/lib/api';

const CACHE_KEYS = ['/report/daily', '/stocks', '/stocks/scan', '/news'] as const;

function extractErrorMessage(e: unknown): string {
  const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data
    ?.detail;
  if (typeof detail === 'string') return detail;
  return 'AI 리포트 작성에 실패했습니다. 데이터 불러오기와 GEMINI_API_KEY 설정을 확인해주세요.';
}

export function useGenerateReport() {
  const { mutate } = useSWRConfig();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await generateReport();
      await Promise.all(CACHE_KEYS.map((key) => mutate(key)));
    } catch (e: unknown) {
      setError(extractErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [mutate]);

  return { generate, loading, error, clearError: () => setError(null) };
}

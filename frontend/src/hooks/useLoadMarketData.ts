'use client';

import { useCallback, useState } from 'react';
import { useSWRConfig } from 'swr';
import { collectMarketData } from '@/lib/api';

const CACHE_KEYS = ['/report/daily', '/stocks', '/stocks/scan', '/news'] as const;

function extractErrorMessage(e: unknown): string {
  const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data
    ?.detail;
  if (typeof detail === 'string') return detail;
  return '데이터 불러오기에 실패했습니다. 백엔드 실행 및 데이터 소스 설정을 확인해주세요.';
}

export function useLoadMarketData() {
  const { mutate } = useSWRConfig();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await collectMarketData();
      await Promise.all(CACHE_KEYS.map((key) => mutate(key)));
    } catch (e: unknown) {
      setError(extractErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [mutate]);

  return { loadData, loading, error, clearError: () => setError(null) };
}

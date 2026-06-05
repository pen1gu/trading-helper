/** 한국 거래소 종목코드(숫자만) 여부 */
export function isKoreanTicker(ticker?: string): boolean {
  return Boolean(ticker && /^\d+$/.test(ticker));
}

/** USD/KRW 등 환율 지수 */
export function isFxIndex(indexName?: string): boolean {
  return indexName === 'USDKRW=X';
}

/** 주식 현재가 (티커 기준 KRW / USD) */
export function formatStockPrice(price?: number | null, ticker?: string): string {
  if (price == null) return '-';

  if (isKoreanTicker(ticker)) {
    return `${price.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}원`;
  }

  return `$${price.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/** 시장 지수·환율 티커 (^KS11, USDKRW=X 등) */
export function formatIndexPrice(price?: number | null, indexName?: string): string {
  if (price == null) return '-';

  if (isFxIndex(indexName)) {
    return `${price.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원`;
  }

  return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** 등락률 포맷팅 (소수점 3자리에서 반올림하여 2자리 표시) */
export function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) return '-';
  // 소수점 3자리에서 반올림하여 2자리까지 표시
  const formattedValue = parseFloat(value.toFixed(2));
  return `${value > 0 ? '+' : ''}${formattedValue}%`;
}

/** 일반 수치 포맷팅 (소수점 2자리 고정) */
export function formatNumber(value: number | undefined | null, decimals: number = 2): string {
  if (value === undefined || value === null) return '-';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

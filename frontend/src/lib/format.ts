/** 한국 거래소 종목코드(숫자만) 여부 */
export function isKoreanTicker(ticker?: string): boolean {
  return Boolean(ticker && /^\d+$/.test(ticker));
}

/** 워런트·단위증권 등 일반 주식 분석에 적합하지 않을 수 있는 US 티커 */
export function isLikelyWarrantOrNonEquity(ticker?: string): boolean {
  if (!ticker) return false;
  const t = ticker.trim().toUpperCase();
  if (isKoreanTicker(t)) return false;
  // US warrant / unit 관례: 티커가 W 또는 U로 끝남 (예: DBCAW, APCXW)
  return /[WU]$/.test(t);
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

/** ROE·배당률 등 퍼센트 지표 (0~1 비율·0~100 퍼센트 모두 처리) */
export function formatRatioPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) return '-';
  const pct = Math.abs(value) <= 1.5 ? value * 100 : value;
  const formattedValue = parseFloat(pct.toFixed(2));
  return `${formattedValue}%`;
}

/** 시가총액을 억 단위로 표시 (국내: 원 → 억, 해외: USD 그대로 억 라벨) */
export function formatMarketCapEok(
  value: number | undefined | null,
  ticker?: string,
): string {
  if (value === undefined || value === null) return '-';
  const scaled = isKoreanTicker(ticker) ? value / 100_000_000 : value;
  return scaled.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** 일반 수치 포맷팅 (소수점 2자리 고정) */
export function formatNumber(value: number | undefined | null, decimals: number = 2): string {
  if (value === undefined || value === null) return '-';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** 날짜 포맷팅 (YYYY-MM-DD, HH:mm:ss 등 지원, 항상 KST 기준) */
export function formatDate(date: string | Date | undefined | null, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  // KST(Asia/Seoul) 시간대로 변환된 문자열 가져오기
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(d);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      partMap[part.type] = part.value;
    }
  }

  // hour가 24인 경우 00으로 변경 (en-US hour12: false 특징)
  let hh = partMap['hour'];
  if (hh === '24') hh = '00';

  const replacements: { [key: string]: string } = {
    'YYYY': partMap['year'],
    'MM': partMap['month'],
    'DD': partMap['day'],
    'HH': hh,
    'mm': partMap['minute'],
    'ss': partMap['second'],
  };

  return format.replace(/YYYY|MM|DD|HH|mm|ss/g, (match) => replacements[match] || match);
}

import { BusinessInsight } from '@/components/BusinessInsightPanel';

export interface Stock {
  ticker: string;
  name: string;
  current_price?: number;
  change_rate: number;
  change_amount?: number;
  volume?: number;
  market_cap?: number;
  per?: number;
  pbr?: number;
  roe?: number;
  dividend_yield?: number;
  foreign_ownership?: number;
  ai_score?: number;
  ai_recommendation?: string;
  business_insight?: BusinessInsight;
}

/**
 * 빌 게이츠(Quality) + 벤저민 그레이엄(Deep Value) 하이브리드 퀀트 스코어 계산
 * 100점 만점
 */
export function calculateQuantScore(stock: Stock): number {
  let score = 0;

  // --- A. 빌 게이츠 퀄리티 전략 (최대 70점) ---
  
  // 1. ROE (자본 효율성 - 40점)
  if (stock.roe != null) {
    if (stock.roe >= 25) score += 40;
    else if (stock.roe >= 15) score += 30;
    else if (stock.roe >= 10) score += 20;
    else if (stock.roe >= 5) score += 10;
  }

  // 2. PER (합리적 가격 - 15점)
  // 너무 낮아도 위험(Value Trap), 적정 수준에 가점
  if (stock.per != null && stock.per > 0) {
    if (stock.per >= 10 && stock.per <= 20) score += 15;
    else if (stock.per < 10) score += 10;
    else if (stock.per <= 30) score += 5;
  }

  // 3. 외국인 지분율 (스마트머니 - 15점)
  if (stock.foreign_ownership != null) {
    if (stock.foreign_ownership >= 30) score += 15;
    else if (stock.foreign_ownership >= 15) score += 10;
    else if (stock.foreign_ownership >= 5) score += 5;
  }

  // --- B. 벤저민 그레이엄 담배꽁초 전략 (최대 30점) ---

  // 1. 극단적 자산 저평가 (PBR - 15점)
  if (stock.pbr != null && stock.pbr > 0) {
    if (stock.pbr < 0.8) score += 15;
    else if (stock.pbr < 1.2) score += 10;
    else if (stock.pbr < 2.0) score += 5;
  }

  // 2. 소형주 턴어라운드 프리미엄 (배당 & 시총 - 15점)
  // 배당률 (최대 10점)
  if (stock.dividend_yield != null) {
    if (stock.dividend_yield >= 4) score += 10;
    else if (stock.dividend_yield >= 2) score += 5;
  }
  
  // 소형주 보너스 (최대 5점) - 시총 5000억 이하 (한국 기준 예시)
  const marketCapEok =
    /^\d+$/.test(stock.ticker) && stock.market_cap != null
      ? stock.market_cap / 100_000_000
      : stock.market_cap;
  if (marketCapEok != null && marketCapEok > 0 && marketCapEok <= 5000) {
    score += 5;
  }

  return Math.min(score, 100);
}

/**
 * 점수대에 따른 등급 및 라벨 반환
 */
export function getQuantGrade(score: number): { label: string; color: string } {
  if (score >= 80) return { label: '강력 매수 (Classic)', color: 'text-up' };
  if (score >= 60) return { label: '매수 우위 (Growth)', color: 'text-[#f59e0b]' };
  if (score >= 40) return { label: '보유 (Hold)', color: 'text-muted' };
  return { label: '관망 (Underweight)', color: 'text-down' };
}

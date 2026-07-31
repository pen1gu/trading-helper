import axios from 'axios';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const fetcher = (url: string) => apiClient.get(url).then((res) => res.data);

export const collectMarketData = () =>
  apiClient.post('/report/collect').then((res) => res.data);

export const fetchCollectStatus = () =>
  apiClient.get('/report/collect-status').then((res) => res.data);

export const generateReport = () =>
  apiClient.post('/report/generate').then((res) => res.data);

export const refreshDailyReport = () =>
  apiClient.post('/report/refresh').then((res) => res.data);

export interface StockRefreshResponse {
  stock: {
    ticker: string;
    name?: string;
    current_price?: number;
    change_rate?: number;
    volume?: number;
    data_collected_at?: string | null;
    [key: string]: unknown;
  };
  errors: string[];
  steps: Record<string, string>;
}

export const refreshStockData = (ticker: string) =>
  apiClient.post<StockRefreshResponse>(`/stocks/${ticker}/refresh`).then((res) => res.data);

// --- Why Buy API types ---

export interface BuyRationalePillar {
  id: string;
  score: number;
  label: string;
  bullets: string[];
  risks?: string[];
}

export interface BuyRationaleResponse {
  overall_score: number;
  verdict: string;
  pillars: BuyRationalePillar[];
  data_freshness: Record<string, string | null>;
}

export interface TechnicalBarPoint {
  trade_date: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume: number;
  ma5?: number | null;
  ma20?: number | null;
  ma60?: number | null;
  rsi14?: number | null;
  macd?: number | null;
  macd_signal?: number | null;
  macd_histogram?: number | null;
}

export interface TechnicalSnapshot {
  close?: number;
  ma5?: number;
  ma20?: number;
  ma60?: number;
  rsi14?: number;
  vs_ma20_pct?: number;
  vs_ma60_pct?: number;
  ma_alignment?: string;
  volume?: number;
  volume_avg_20d?: number;
  volume_ratio_vs_20d?: number;
}

export interface TechnicalIndicatorsResponse {
  bars: TechnicalBarPoint[];
  snapshot: TechnicalSnapshot;
}

export interface AnnualFinancialRow {
  fiscal_year: number;
  revenue?: number | null;
  operating_income?: number | null;
  operating_margin_pct?: number | null;
  rd_expense?: number | null;
  operating_cash_flow?: number | null;
  revenue_yoy_pct?: number | null;
  operating_income_yoy_pct?: number | null;
}

export interface FinancialsResponse {
  status: string;
  ticker: string;
  source?: string;
  message?: string;
  rows: AnnualFinancialRow[];
  data_years?: number[];
  revenue_cagr_3y_pct?: number | null;
  collected_at?: string | null;
}

export interface NewsSummaryResponse {
  status: string;
  avg_sentiment?: number | null;
  positive_count?: number;
  negative_count?: number;
  neutral_count?: number;
  top_keywords?: string[];
  article_count?: number;
  period_days?: number;
  message?: string;
}

export interface DisclosureItem {
  id?: number;
  rcept_no: string;
  report_nm: string;
  report_type: string;
  rcept_dt: string;
  dart_url: string;
  summary?: string | null;
}

export interface DisclosuresResponse {
  status: string;
  ticker: string;
  items: DisclosureItem[];
  message?: string;
}

export interface EarningsCalendarResponse {
  status: string;
  ticker: string;
  next_earnings_date?: string | null;
  next_earnings_days?: number | null;
  next_earnings_label?: string | null;
  last_earnings_date?: string | null;
  last_earnings_days_ago?: number | null;
  confidence?: string | null;
  message?: string;
}

export interface InvestorFlowDaily {
  trade_date: string;
  foreign_net: number;
  institutional_net: number;
  individual_net: number;
}

export interface InvestorFlowSnapshot {
  foreign_net_5d?: number | null;
  foreign_net_20d?: number | null;
  institutional_net_5d?: number | null;
  flow_streak?: number | null;
  flow_signal?: string | null;
}

export interface InvestorFlowResponse {
  status: string;
  ticker: string;
  daily: InvestorFlowDaily[];
  snapshot: InvestorFlowSnapshot;
  message?: string;
}

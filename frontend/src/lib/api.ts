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

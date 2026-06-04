'use client';

import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts';

interface RadarData {
  profitability: number;
  growth: number;
  valuation: number;
  stability: number;
  momentum: number;
}

interface Props {
  data: RadarData;
}

export default function RadarChartComponent({ data }: Props) {
  const chartData = [
    { subject: '수익성', A: data.profitability, fullMark: 10 },
    { subject: '성장성', A: data.growth, fullMark: 10 },
    { subject: '저평가', A: data.valuation, fullMark: 10 },
    { subject: '안정성', A: data.stability, fullMark: 10 },
    { subject: '모멘텀', A: data.momentum, fullMark: 10 },
  ];

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }} />
          <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
          <Radar
            name="AI Score"
            dataKey="A"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.4}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}

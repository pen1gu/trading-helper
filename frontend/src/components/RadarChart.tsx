'use client';

import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
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
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
          <PolarGrid stroke="#e5e5e5" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#737373', fontSize: 12, fontWeight: 600 }} />
          <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
          <Radar name="AI Score" dataKey="A" stroke="#171717" fill="#171717" fillOpacity={0.2} />
          <Tooltip
            contentStyle={{
              borderRadius: '10px',
              border: '1px solid #e5e5e5',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            }}
            itemStyle={{ color: '#171717', fontWeight: 'bold' }}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}

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
import { chartColors } from '@/lib/chart-colors';

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
          <PolarGrid stroke={chartColors.grid} />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b5f7a', fontSize: 12, fontWeight: 500 }} />
          <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
          <Radar
            name="AI Score"
            dataKey="A"
            stroke={chartColors.radar.stroke}
            fill={chartColors.radar.fill}
            fillOpacity={0.65}
          />
          <Tooltip
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #f0e8f5',
              boxShadow: '0 4px 16px rgba(167, 139, 250, 0.1)',
            }}
            itemStyle={{ color: '#3d3550', fontWeight: 600 }}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}

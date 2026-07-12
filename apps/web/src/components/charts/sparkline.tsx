'use client';

import {AreaChart, Area, ResponsiveContainer, YAxis} from 'recharts';

export interface SparklinePoint {
  priceCents: number;
  at: string | Date;
}

export function Sparkline({points, height = 44}: {points: SparklinePoint[]; height?: number}) {
  if (points.length < 2) {
    return <div style={{height}} className="w-full" />;
  }

  const trendingUp = points[points.length - 1].priceCents >= points[0].priceCents;
  const color = trendingUp ? 'var(--success)' : 'var(--destructive)';
  const gradientId = `sparkline-${trendingUp ? 'up' : 'down'}`;

  return (
    <div style={{height}} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{top: 2, right: 0, bottom: 2, left: 0}}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={[0, 100]} hide />
          <Area
            type="monotone"
            dataKey="priceCents"
            stroke={color}
            strokeWidth={1.75}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export interface PriceSeries {
  id: string;
  label: string;
  color: string;
  points: {priceCents: number; at: string | Date}[];
}

function mergeSeries(series: PriceSeries[]) {
  const timestamps = Array.from(
    new Set(series.flatMap((s) => s.points.map((p) => new Date(p.at).getTime())))
  ).sort((a, b) => a - b);

  return timestamps.map((t) => {
    const row: Record<string, number> = {at: t};
    for (const s of series) {
      const point = s.points.find((p) => new Date(p.at).getTime() === t);
      if (point) row[s.id] = point.priceCents;
    }
    return row;
  });
}

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function ChartTooltip({
  active,
  payload,
  label,
  series,
}: {
  active?: boolean;
  payload?: {dataKey: string; value: number}[];
  label?: number;
  series: PriceSeries[];
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 text-muted-foreground">{formatTime(label)}</p>
      {payload.map((entry) => {
        const s = series.find((item) => item.id === entry.dataKey);
        if (!s) return null;
        return (
          <p key={entry.dataKey} className="flex items-center gap-1.5 font-medium">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{backgroundColor: s.color}}
            />
            {s.label}: {entry.value}¢
          </p>
        );
      })}
    </div>
  );
}

export function PriceChart({series, height = 280}: {series: PriceSeries[]; height?: number}) {
  const data = mergeSeries(series);

  if (data.length < 2) {
    return (
      <div
        style={{height}}
        className="flex w-full items-center justify-center text-sm text-muted-foreground"
      >
        Not enough price history yet.
      </div>
    );
  }

  return (
    <div style={{height}} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{top: 8, right: 12, bottom: 0, left: -16}}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="at"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatTime}
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}¢`}
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip content={<ChartTooltip series={series} />} />
          <Legend
            wrapperStyle={{fontSize: 12, paddingTop: 8}}
            formatter={(value) => series.find((s) => s.id === value)?.label ?? value}
          />
          {series.map((s) => (
            <Line
              key={s.id}
              type="monotone"
              dataKey={s.id}
              name={s.id}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{r: 4}}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

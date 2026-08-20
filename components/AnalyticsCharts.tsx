"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type RankedBarChartProps = {
  data: Record<string, unknown>[];
  nameKey: string;
  valueKey: string;
  color?: string;
  colorByValue?: boolean; // green if >=0, coral if <0
};

export function RankedBarChart({
  data,
  nameKey,
  valueKey,
  color = "#378ADD",
  colorByValue = false,
}: RankedBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(280, data.length * 34)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#88888833" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey={nameKey} width={140} tick={{ fontSize: 12 }} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey={valueKey} radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={
                colorByValue
                  ? (d[valueKey] as number) >= 0
                    ? "#1D9E75"
                    : "#D85A30"
                  : color
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

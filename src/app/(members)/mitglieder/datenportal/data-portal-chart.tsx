"use client";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ChartDatum = { name: string; value: number };

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

/** Balken- oder Kreisdiagramm für gruppierte Auswertungen. Zeigt höchstens 20 Gruppen. */
export function DataPortalChart({ data, type }: { data: ChartDatum[]; type: "bar" | "pie" }) {
  const shown = data.slice(0, 20);
  const height = type === "bar" ? Math.max(200, shown.length * 34 + 40) : 320;
  return (
    <div
      className="w-full"
      style={{ height }}
      role="img"
      aria-label={`Diagramm mit ${shown.length} Gruppen`}
    >
      <ResponsiveContainer width="100%" height="100%">
        {type === "bar" ? (
          <BarChart data={shown} layout="vertical" margin={{ left: 8, right: 16 }}>
            <XAxis
              type="number"
              allowDecimals={false}
              stroke="var(--muted-foreground)"
              fontSize={12}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickFormatter={(value: string) =>
                value.length > 16 ? `${value.slice(0, 15)}…` : value
              }
            />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
            <Bar
              dataKey="value"
              name="Anzahl"
              fill="var(--chart-1)"
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        ) : (
          <PieChart>
            <Pie
              data={shown}
              dataKey="value"
              nameKey="name"
              innerRadius="45%"
              outerRadius="75%"
              isAnimationActive={false}
            >
              {shown.map((entry, index) => (
                <Cell key={entry.name} fill={COLORS[index % COLORS.length]} stroke="var(--card)" />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

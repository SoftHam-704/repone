import { ArrowUpRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

const data = [
  { month: "Jul", value: 55 },
  { month: "Aug", value: 48 },
  { month: "Sep", value: 52 },
  { month: "Oct", value: 58 },
  { month: "Nov", value: 65 },
  { month: "Dec", value: 70 },
];

export function KPIChart() {
  return (
    <div className="bg-card rounded-2xl p-4 border border-border/25 shadow-[var(--card-shadow)] flex-1">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-3xl font-bold text-foreground">70,32%</div>
          <div className="text-xs text-muted-foreground">Average Team KPI</div>
        </div>
        <button className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
          <ArrowUpRight className="w-4 h-4 text-foreground" />
        </button>
      </div>

      <div style={{ height: 120, minHeight: 120, width: '100%', marginTop: 8 }}>
        <ResponsiveContainer width="99%" height="100%">
          <LineChart data={data}>
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "hsl(30 8% 50%)" }}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                background: "hsl(0 0% 100%)",
                border: "1px solid hsl(40 20% 88%)",
                borderRadius: "8px",
                fontSize: "11px",
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(45 80% 55%)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: "hsl(45 80% 55%)" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

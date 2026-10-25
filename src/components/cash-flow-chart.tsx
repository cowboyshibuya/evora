import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { monthlySeries } from "@/lib/finance";
import type { Entry } from "@/lib/types";
import { money } from "@/lib/utils";

export function CashFlowChart({
  entries,
  currency,
  months = 6,
  variant = "overview",
}: {
  entries: Entry[];
  currency?: string;
  months?: number;
  variant?: "overview" | "report";
}) {
  const gradient = useId().replaceAll(":", "");
  const report = variant === "report";
  return (
    <div
      className={report ? "report-chart" : "cashflow-chart"}
      role="img"
      aria-label={`Cash flow over the last ${months} months. Income and expenses shown monthly.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={monthlySeries(entries, months)}
          margin={
            report
              ? { top: 15, right: 10, left: -15, bottom: 10 }
              : { left: -18, right: 8, top: 12, bottom: 0 }
          }
        >
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.12} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{
              fill: "var(--muted-foreground)",
              fontSize: report ? 10 : 11,
            }}
            dy={report ? 0 : 8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{
              fill: "var(--muted-foreground)",
              fontSize: report ? 10 : 11,
            }}
            tickFormatter={(n) => `${n / 1000}k`}
            tickCount={5}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            contentStyle={{
              borderRadius: 9,
              border: "1px solid var(--border)",
              fontSize: 12,
            }}
            formatter={(value, name) => [
              money(Number(value) * 100, currency),
              name === "income" ? "Income" : "Expenses",
            ]}
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="expenses"
            stroke="var(--chart-3)"
            strokeWidth={1.8}
            strokeDasharray="5 5"
            fill="transparent"
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="income"
            stroke="var(--primary)"
            strokeWidth={2.2}
            fill={`url(#${gradient})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

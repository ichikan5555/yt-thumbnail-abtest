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
import type { VariantResult } from "../api/types";
import { useT } from "../i18n/I18nContext";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b"];

export default function VelocityChart({
  variants,
}: {
  variants: VariantResult[];
}) {
  const t = useT();

  const data = variants.map((v) => ({
    label: t("thumbnail.pattern", { label: v.label }),
    velocity: Number(v.avg_velocity.toFixed(1)),
    views: v.total_views_gained,
    isWinner: v.is_winner,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis label={{ value: t("chart.velocityUnit"), angle: -90, position: "insideLeft" }} />
        <Tooltip
          formatter={(value, name) => {
            if (name === "velocity") return [`${value} views/h`, t("chart.avgVelocity")];
            return [String(value), String(name)];
          }}
        />
        <Bar dataKey="velocity" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

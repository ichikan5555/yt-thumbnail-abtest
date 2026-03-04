import { METRIC_KEYS } from "../api/types";
import { useT } from "../i18n/I18nContext";

interface Props {
  weights: Record<string, number>;
  onChange: (weights: Record<string, number>) => void;
}

const COLORS: Record<string, string> = {
  view_velocity: "bg-blue-500",
  impressions: "bg-purple-500",
  ctr: "bg-green-500",
  avg_view_duration: "bg-orange-500",
  avg_view_percentage: "bg-yellow-500",
  watch_time: "bg-red-500",
  likes: "bg-pink-500",
  shares: "bg-teal-500",
  comments: "bg-indigo-500",
};

export default function WeightSliders({ weights, onChange }: Props) {
  const t = useT();

  const handleChange = (key: string, value: number) => {
    onChange({ ...weights, [key]: value });
  };

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-700">{t("weights.title")}</h4>
        <span className="text-xs text-gray-500">{t("weights.total", { total: totalWeight })}</span>
      </div>

      {/* 重み分布バー */}
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-200">
        {METRIC_KEYS.filter((k) => weights[k] > 0).map((key) => (
          <div
            key={key}
            className={`${COLORS[key]} transition-all duration-200`}
            style={{ width: `${(weights[key] / totalWeight) * 100}%` }}
            title={`${t(`metric.${key}`)}: ${weights[key]}`}
          />
        ))}
      </div>

      {/* スライダー */}
      <div className="space-y-2">
        {METRIC_KEYS.map((key) => {
          const pct = totalWeight > 0 ? ((weights[key] / totalWeight) * 100).toFixed(0) : "0";
          return (
            <div key={key} className="flex items-center gap-3">
              <div className="w-40 text-xs text-gray-600 truncate" title={t(`metric.${key}`)}>
                {t(`metric.${key}`)}
              </div>
              <input
                type="range"
                min={0}
                max={10}
                value={weights[key]}
                onChange={(e) => handleChange(key, Number(e.target.value))}
                className="flex-1 h-1.5 accent-indigo-600"
              />
              <div className="w-8 text-xs text-right font-mono text-gray-700">
                {weights[key]}
              </div>
              <div className="w-10 text-xs text-right text-gray-400">
                {pct}%
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400">
        {t("weights.help")}
      </p>
    </div>
  );
}

import type { Quota } from "../api/types";
import { useT } from "../i18n/I18nContext";

export default function QuotaBar({ quota }: { quota: Quota | null }) {
  const t = useT();

  if (!quota) return null;

  const pct = Math.min(quota.pct, 100);
  const barColor = pct > 80 ? "bg-red-500" : pct > 50 ? "bg-yellow-500" : "bg-green-500";

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium">{t("quota.title")}</span>
        <span className="text-gray-500">
          {quota.used.toLocaleString()} / {quota.limit.toLocaleString()} ({pct.toFixed(1)}%)
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-500 mt-1">
        {t("quota.remaining", { remaining: quota.remaining.toLocaleString(), est: quota.est_tests_possible })}
      </p>
    </div>
  );
}

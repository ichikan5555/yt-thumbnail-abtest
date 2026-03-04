import { useT } from "../i18n/I18nContext";
import type { VariantHeatmap } from "../api/types";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface Props {
  variants: VariantHeatmap[];
}

export default function HeatmapGrid({ variants }: Props) {
  const t = useT();

  if (variants.length === 0) return null;

  return (
    <div className="space-y-6">
      {variants.map((v) => {
        // Build lookup: (weekday, hour) -> velocity
        const lookup = new Map<string, number>();
        let maxVel = 0;
        for (const cell of v.cells) {
          const key = `${cell.weekday}-${cell.hour}`;
          lookup.set(key, cell.avg_velocity);
          if (cell.avg_velocity > maxVel) maxVel = cell.avg_velocity;
        }

        return (
          <div key={v.label}>
            <h4 className="text-sm font-medium mb-2">
              {t("newTest.variant", { label: v.label })}
            </h4>
            <div className="overflow-x-auto">
              <div className="inline-grid" style={{ gridTemplateColumns: `56px repeat(24, 28px)` }}>
                {/* Header row */}
                <div className="text-xs text-gray-400" />
                {HOURS.map((h) => (
                  <div key={h} className="text-center text-[10px] text-gray-400 pb-1">
                    {h}
                  </div>
                ))}

                {/* Data rows */}
                {DAYS.map((day, di) => (
                  <>
                    <div key={`label-${day}`} className="text-xs text-gray-500 flex items-center pr-2">
                      {t(`heatmap.${day}`)}
                    </div>
                    {HOURS.map((h) => {
                      const vel = lookup.get(`${di}-${h}`) ?? 0;
                      const intensity = maxVel > 0 ? vel / maxVel : 0;
                      return (
                        <div
                          key={`${di}-${h}`}
                          className="w-7 h-6 rounded-sm border border-gray-100"
                          style={{
                            backgroundColor: `rgba(99, 102, 241, ${intensity * 0.85 + 0.05})`,
                          }}
                          title={`${t(`heatmap.${day}`)} ${h}:00 — ${vel.toFixed(1)} v/h`}
                        />
                      );
                    })}
                  </>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

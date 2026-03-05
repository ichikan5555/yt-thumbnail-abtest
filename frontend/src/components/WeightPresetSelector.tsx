import { useState } from "react";
import { useT } from "../i18n/I18nContext";
import WeightSliders from "./WeightSliders";

const PRESETS: Record<string, Record<string, number>> = {
  balanced: {
    view_velocity: 5,
    impressions: 2,
    ctr: 5,
    avg_view_duration: 4,
    avg_view_percentage: 3,
    watch_time: 2,
    likes: 2,
    shares: 1,
    comments: 1,
  },
  ctr_focused: {
    view_velocity: 3,
    impressions: 5,
    ctr: 10,
    avg_view_duration: 2,
    avg_view_percentage: 2,
    watch_time: 1,
    likes: 1,
    shares: 1,
    comments: 1,
  },
  retention_focused: {
    view_velocity: 5,
    impressions: 1,
    ctr: 3,
    avg_view_duration: 10,
    avg_view_percentage: 8,
    watch_time: 5,
    likes: 1,
    shares: 1,
    comments: 1,
  },
};

function weightsMatch(a: Record<string, number>, b: Record<string, number>): boolean {
  for (const key of Object.keys(b)) {
    if ((a[key] ?? 0) !== b[key]) return false;
  }
  return true;
}

interface Props {
  weights: Record<string, number>;
  onChange: (weights: Record<string, number>) => void;
}

export default function WeightPresetSelector({ weights, onChange }: Props) {
  const t = useT();

  // Detect current preset
  const detectPreset = (): string => {
    for (const [name, preset] of Object.entries(PRESETS)) {
      if (weightsMatch(weights, preset)) return name;
    }
    return "custom";
  };

  const [selected, setSelected] = useState(detectPreset);
  const [customOpen, setCustomOpen] = useState(selected === "custom");

  const handlePreset = (name: string) => {
    setSelected(name);
    if (name === "custom") {
      setCustomOpen(true);
    } else {
      setCustomOpen(false);
      onChange({ ...PRESETS[name] });
    }
  };

  const presetOptions = [
    { key: "balanced", label: t("preset.balanced"), desc: t("preset.balancedDesc") },
    { key: "ctr_focused", label: t("preset.ctrFocused"), desc: t("preset.ctrFocusedDesc") },
    { key: "retention_focused", label: t("preset.retentionFocused"), desc: t("preset.retentionFocusedDesc") },
    { key: "custom", label: t("preset.custom"), desc: t("preset.customDesc") },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700 mb-2">
        {t("preset.title")}
      </h3>

      <div className="space-y-2">
        {presetOptions.map((opt) => (
          <label
            key={opt.key}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              selected === opt.key
                ? "border-indigo-300 bg-indigo-50"
                : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            <input
              type="radio"
              name="weight_preset"
              checked={selected === opt.key}
              onChange={() => handlePreset(opt.key)}
              className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <div className="text-sm font-medium text-gray-800">{opt.label}</div>
              <div className="text-xs text-gray-500">{opt.desc}</div>
            </div>
          </label>
        ))}
      </div>

      {/* Custom sliders (collapsible) */}
      {selected === "custom" && customOpen && (
        <div className="mt-3 pl-2 border-l-2 border-indigo-200">
          <WeightSliders weights={weights} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

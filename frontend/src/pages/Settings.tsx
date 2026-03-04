import { useState, useEffect } from "react";
import { getSettings, updateSettings } from "../api/client";
import { DEFAULT_WEIGHTS } from "../api/types";
import type { Settings as SettingsType } from "../api/types";
import WeightSliders from "../components/WeightSliders";
import { useT } from "../i18n/I18nContext";

const CHANNEL_OPTIONS = ["chatwork", "email", "slack"] as const;

export default function Settings() {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [rotationInterval, setRotationInterval] = useState(30);
  const [cycles, setCycles] = useState(1);
  const [numPatterns, setNumPatterns] = useState(3);
  const [metricWeights, setMetricWeights] = useState<Record<string, number>>({
    ...DEFAULT_WEIGHTS,
  });
  const [channels, setChannels] = useState<string[]>([
    "chatwork",
    "email",
    "slack",
  ]);

  useEffect(() => {
    getSettings()
      .then((s: SettingsType) => {
        setRotationInterval(s.default_rotation_interval);
        setCycles(s.default_cycles);
        setNumPatterns(s.default_num_patterns);
        if (
          s.default_metric_weights &&
          Object.keys(s.default_metric_weights).length > 0
        ) {
          setMetricWeights(s.default_metric_weights);
        }
        setChannels(s.notification_channels);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleChannel = (ch: string) => {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await updateSettings({
        default_rotation_interval: rotationInterval,
        default_cycles: cycles,
        default_num_patterns: numPatterns,
        default_metric_weights: metricWeights,
        notification_channels: channels,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError(t("settings.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-gray-500">{t("common.loading")}</p>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{t("settings.title")}</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4 text-sm">
          {t("settings.saved")}
        </div>
      )}

      {/* Test Defaults */}
      <section className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">
          {t("settings.defaults")}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {t("settings.defaultsDescription")}
        </p>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("settings.numPatterns")}
            </label>
            <select
              value={numPatterns}
              onChange={(e) => setNumPatterns(Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value={2}>2 (A / B)</option>
              <option value={3}>3 (A / B / C)</option>
              <option value={4}>4 (A / B / C / D)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("settings.rotationInterval")}
            </label>
            <select
              value={rotationInterval}
              onChange={(e) => setRotationInterval(Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value={5}>5 min</option>
              <option value={10}>10 min</option>
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={60}>60 min</option>
              <option value={120}>120 min</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("settings.cycles")}
            </label>
            <select
              value={cycles}
              onChange={(e) => setCycles(Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            {t("settings.metricWeights")}
          </h3>
          <WeightSliders weights={metricWeights} onChange={setMetricWeights} />
        </div>
      </section>

      {/* Notification Channels */}
      <section className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">
          {t("settings.notifications")}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {t("settings.notificationsDescription")}
        </p>

        <div className="space-y-3">
          {CHANNEL_OPTIONS.map((ch) => (
            <label
              key={ch}
              className="flex items-center gap-3 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={channels.includes(ch)}
                onChange={() => toggleChannel(ch)}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">
                {t(`settings.${ch}`)}
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-indigo-600 text-white px-6 py-2 rounded text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? t("settings.saving") : t("settings.save")}
      </button>
    </div>
  );
}

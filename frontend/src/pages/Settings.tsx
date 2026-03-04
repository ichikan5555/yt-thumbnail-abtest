import { useState, useEffect } from "react";
import { getSettings, updateSettings, createBackup, listBackups, downloadBackup, deleteBackup, listTemplates, deleteTemplate, uploadLogo, deleteLogo, getLogo } from "../api/client";
import { DEFAULT_WEIGHTS } from "../api/types";
import type { Settings as SettingsType, BackupItem, TestTemplate } from "../api/types";
import WeightSliders from "../components/WeightSliders";
import { useT } from "../i18n/I18nContext";
import { useAuth } from "../context/AuthContext";

const CHANNEL_OPTIONS = ["chatwork", "email", "slack"] as const;

export default function Settings() {
  const t = useT();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Backup state
  const isPro = user?.plan === "pro" || user?.trial_active === true;
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupCreating, setBackupCreating] = useState(false);
  const [backupMsg, setBackupMsg] = useState("");

  // Template state
  const [templates, setTemplates] = useState<TestTemplate[]>([]);

  // Logo state
  const [hasLogo, setHasLogo] = useState(false);
  const [logoMsg, setLogoMsg] = useState("");

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

  const loadBackups = () => {
    if (!isPro) return;
    setBackupLoading(true);
    listBackups()
      .then(setBackups)
      .catch(() => {})
      .finally(() => setBackupLoading(false));
  };

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
    loadBackups();
    listTemplates().then(setTemplates).catch(() => {});
    getLogo().then((s) => setHasLogo(s.has_logo)).catch(() => {});
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

      {/* Template Management Section */}
      <section className="bg-white rounded-lg border border-gray-200 p-5 mt-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">
          {t("template.title")}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {t("template.description")}
        </p>

        {templates.length === 0 ? (
          <p className="text-gray-400 text-sm">{t("template.noTemplates")}</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  {t("template.colName")}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  {t("template.colSettings")}
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {templates.map((tpl) => (
                <tr key={tpl.name}>
                  <td className="px-3 py-2 text-sm font-medium">{tpl.name}</td>
                  <td className="px-3 py-2 text-sm text-gray-500">
                    {t("template.summary", {
                      patterns: String(tpl.num_patterns),
                      interval: String(tpl.rotation_interval),
                      cycles: String(tpl.cycles),
                    })}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={async () => {
                        if (!confirm(t("template.confirmDelete", { name: tpl.name }))) return;
                        await deleteTemplate(tpl.name);
                        listTemplates().then(setTemplates).catch(() => {});
                      }}
                      className="text-xs text-red-500 hover:underline"
                    >
                      {t("template.delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Backup Section */}
      <section className="bg-white rounded-lg border border-gray-200 p-5 mt-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">
          {t("backup.title")}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {t("backup.description")}
        </p>

        {!isPro ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
            <p className="text-amber-700 text-sm font-medium mb-1">
              {t("backup.proOnly")}
            </p>
            <p className="text-amber-600 text-xs">
              {t("backup.proOnlyDesc")}
            </p>
          </div>
        ) : (
          <>
            <button
              onClick={async () => {
                setBackupCreating(true);
                setBackupMsg("");
                try {
                  const result = await createBackup();
                  setBackupMsg(
                    t("backup.created", {
                      filename: result.filename,
                      count: String(result.test_count),
                    })
                  );
                  loadBackups();
                } catch {
                  setBackupMsg(t("backup.createFailed"));
                } finally {
                  setBackupCreating(false);
                }
              }}
              disabled={backupCreating}
              className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 disabled:opacity-50 mb-3"
            >
              {backupCreating
                ? t("backup.creating")
                : t("backup.createBtn")}
            </button>

            {backupMsg && (
              <p className="text-sm text-gray-600 mb-3">{backupMsg}</p>
            )}

            {backupLoading ? (
              <p className="text-gray-400 text-sm">{t("common.loading")}</p>
            ) : backups.length === 0 ? (
              <p className="text-gray-400 text-sm">{t("backup.noBackups")}</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      {t("backup.colFile")}
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      {t("backup.colSize")}
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      {t("backup.colDate")}
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {backups.map((b) => (
                    <tr key={b.filename}>
                      <td className="px-3 py-2 text-sm font-mono">
                        {b.filename}
                      </td>
                      <td className="px-3 py-2 text-sm text-right text-gray-500">
                        {(b.size / 1024).toFixed(1)} KB
                      </td>
                      <td className="px-3 py-2 text-sm text-right text-gray-500">
                        {new Date(b.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-center space-x-2">
                        <button
                          onClick={() => downloadBackup(b.filename)}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          {t("backup.download")}
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(t("backup.confirmDelete"))) return;
                            await deleteBackup(b.filename);
                            loadBackups();
                          }}
                          className="text-xs text-red-500 hover:underline"
                        >
                          {t("backup.delete")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>

      {/* Report Logo Section */}
      <section className="bg-white rounded-lg border border-gray-200 p-5 mt-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">
          {t("report.title")}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {t("report.description")}
        </p>

        {!isPro ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
            <p className="text-amber-700 text-sm font-medium mb-1">
              {t("report.proOnly")}
            </p>
            <p className="text-amber-600 text-xs">
              {t("report.proOnlyDesc")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {hasLogo ? (
              <div className="flex items-center gap-4">
                <img
                  src={`/api/settings/logo/preview?t=${Date.now()}`}
                  alt="Logo"
                  className="h-10 border rounded"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <button
                  onClick={async () => {
                    setLogoMsg("");
                    try {
                      await deleteLogo();
                      setHasLogo(false);
                      setLogoMsg(t("report.logoDeleted"));
                    } catch {
                      setLogoMsg(t("report.logoFailed"));
                    }
                  }}
                  className="text-xs text-red-500 hover:underline"
                >
                  {t("report.logoDelete")}
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-400">{t("report.noLogo")}</p>
            )}
            <div>
              <label className="inline-block bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 cursor-pointer">
                {t("report.logoUpload")}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setLogoMsg("");
                    try {
                      await uploadLogo(file);
                      setHasLogo(true);
                      setLogoMsg(t("report.logoUploaded"));
                    } catch {
                      setLogoMsg(t("report.logoFailed"));
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {logoMsg && (
              <p className="text-sm text-gray-600">{logoMsg}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

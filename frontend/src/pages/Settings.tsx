import { useState, useEffect } from "react";
import { getSettings, updateSettings, createBackup, listBackups, downloadBackup, deleteBackup, listTemplates, deleteTemplate, uploadLogo, deleteLogo, getLogo, getYouTubeStatus, saveYouTubeCredentials, connectYouTube, disconnectYouTube } from "../api/client";
import type { UpdateAuthMethodData } from "../api/client";
import { DEFAULT_WEIGHTS } from "../api/types";
import type { Settings as SettingsType, BackupItem, TestTemplate, YouTubeStatus } from "../api/types";
import WeightPresetSelector from "../components/WeightPresetSelector";
import { useT } from "../i18n/I18nContext";
import { useAuth } from "../context/AuthContext";

const CHANNEL_OPTIONS = ["chatwork", "email", "slack"] as const;

export default function Settings() {
  const t = useT();
  const { user, refresh, updateAuthMethod } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // YouTube state
  const [ytStatus, setYtStatus] = useState<YouTubeStatus | null>(null);
  const [ytClientId, setYtClientId] = useState("");
  const [ytClientSecret, setYtClientSecret] = useState("");
  const [ytSaving, setYtSaving] = useState(false);
  const [ytMsg, setYtMsg] = useState("");
  const [ytConnecting, setYtConnecting] = useState(false);

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

  // Auth method state
  type AuthMethod = "password" | "2fa_email" | "2fa_chatwork";
  const [authMethod, setAuthMethod] = useState<AuthMethod>((user?.auth_method as AuthMethod) || "password");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState("");
  const [authChatworkRoomId, setAuthChatworkRoomId] = useState("");
  const [authChatworkApiToken, setAuthChatworkApiToken] = useState("");
  const [authSaving, setAuthSaving] = useState(false);
  const [authMsg, setAuthMsg] = useState("");
  const [authError, setAuthError] = useState("");

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

  const loadYouTubeStatus = () => {
    getYouTubeStatus()
      .then(setYtStatus)
      .catch(() => {});
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
    loadYouTubeStatus();

    // Check for youtube=connected query param
    const params = new URLSearchParams(window.location.search);
    if (params.get("youtube") === "connected") {
      setYtMsg(t("youtube.connected"));
      loadYouTubeStatus();
      refresh();
      // Clean URL
      window.history.replaceState({}, "", "/settings");
    }
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

  const handleYtSaveCredentials = async () => {
    setYtSaving(true);
    setYtMsg("");
    try {
      await saveYouTubeCredentials(ytClientId, ytClientSecret);
      setYtMsg(t("youtube.credentialsSaved"));
      loadYouTubeStatus();
    } catch {
      setYtMsg(t("youtube.credentialsFailed"));
    } finally {
      setYtSaving(false);
    }
  };

  const handleYtConnect = async () => {
    setYtConnecting(true);
    setYtMsg("");
    try {
      const { url } = await connectYouTube();
      window.location.href = url;
    } catch {
      setYtMsg(t("youtube.connectFailed"));
      setYtConnecting(false);
    }
  };

  const handleYtDisconnect = async () => {
    if (!confirm(t("youtube.confirmDisconnect"))) return;
    try {
      await disconnectYouTube();
      setYtStatus(null);
      loadYouTubeStatus();
      refresh();
      setYtMsg(t("youtube.disconnected"));
    } catch {
      setYtMsg(t("youtube.disconnectFailed"));
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

      {/* YouTube Connection */}
      <section className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">
          {t("youtube.title")}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {t("youtube.description")}
        </p>

        {ytStatus?.connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 bg-green-500 rounded-full" />
              <span className="text-sm font-medium text-green-700">
                {t("youtube.connectedLabel")}
              </span>
              {ytStatus.channel_title && (
                <span className="text-sm text-gray-500">— {ytStatus.channel_title}</span>
              )}
            </div>
            <button
              onClick={handleYtDisconnect}
              className="text-xs text-red-500 hover:underline"
            >
              {t("youtube.disconnect")}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {!ytStatus?.has_credentials && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">{t("youtube.credentialsHelp")}</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={ytClientId}
                    onChange={(e) => setYtClientId(e.target.value)}
                    placeholder="xxxxxxxxx.apps.googleusercontent.com"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Secret
                  </label>
                  <input
                    type="password"
                    value={ytClientSecret}
                    onChange={(e) => setYtClientSecret(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <button
                  onClick={handleYtSaveCredentials}
                  disabled={ytSaving || !ytClientId || !ytClientSecret}
                  className="bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-700 disabled:opacity-50"
                >
                  {ytSaving ? t("settings.saving") : t("youtube.saveCredentials")}
                </button>
              </div>
            )}

            {ytStatus?.has_credentials && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 bg-yellow-500 rounded-full" />
                  <span className="text-sm text-yellow-700">{t("youtube.notConnected")}</span>
                </div>
                <button
                  onClick={handleYtConnect}
                  disabled={ytConnecting}
                  className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  {ytConnecting ? t("youtube.connecting") : t("youtube.connectBtn")}
                </button>
              </div>
            )}
          </div>
        )}

        {ytMsg && (
          <p className="text-sm text-gray-600 mt-3">{ytMsg}</p>
        )}
      </section>

      {/* Auth Method */}
      <section className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">
          {t("settings.authMethod")}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {t("settings.authMethodDesc")}
        </p>

        <div className="space-y-3 mb-4">
          {([
            { value: "password" as AuthMethod, labelKey: "settings.methodPassword", descKey: "settings.methodPasswordDesc" },
            { value: "2fa_email" as AuthMethod, labelKey: "settings.method2faEmail", descKey: "settings.method2faEmailDesc" },
            { value: "2fa_chatwork" as AuthMethod, labelKey: "settings.method2faChatwork", descKey: "settings.method2faChatworkDesc" },
          ]).map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                authMethod === opt.value ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="auth_method_setting"
                value={opt.value}
                checked={authMethod === opt.value}
                onChange={() => { setAuthMethod(opt.value); setAuthMsg(""); setAuthError(""); }}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-medium text-gray-800">
                  {t(opt.labelKey)}
                  {user?.auth_method === opt.value && (
                    <span className="ml-2 text-xs text-green-600 font-normal">({t("settings.currentMethod")})</span>
                  )}
                </div>
                <div className="text-xs text-gray-500">{t(opt.descKey)}</div>
              </div>
            </label>
          ))}
        </div>

        {/* Password fields */}
        {authMethod === "password" && authMethod !== user?.auth_method && (
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("settings.newPassword")}</label>
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                minLength={8}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">{t("register.passwordHint")}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("settings.newPasswordConfirm")}</label>
              <input
                type="password"
                value={authPasswordConfirm}
                onChange={(e) => setAuthPasswordConfirm(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        )}

        {/* Chatwork fields */}
        {authMethod === "2fa_chatwork" && (
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("register.chatworkToken")}</label>
              <input
                type="password"
                value={authChatworkApiToken}
                onChange={(e) => setAuthChatworkApiToken(e.target.value)}
                placeholder="xxxxxxxxxxxxxxxxxxxx"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">{t("register.chatworkTokenHint")}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("register.chatworkRoomId")}</label>
              <input
                type="text"
                value={authChatworkRoomId}
                onChange={(e) => setAuthChatworkRoomId(e.target.value)}
                placeholder="253108411"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">{t("register.chatworkRoomHint")}</p>
            </div>
          </div>
        )}

        <button
          onClick={async () => {
            setAuthMsg("");
            setAuthError("");

            if (authMethod === "password" && authMethod !== user?.auth_method) {
              if (authPassword.length < 8) { setAuthError(t("register.passwordMin")); return; }
              if (authPassword !== authPasswordConfirm) { setAuthError(t("register.passwordMismatch")); return; }
            }
            if (authMethod === "2fa_chatwork") {
              if (!authChatworkApiToken.trim()) { setAuthError(t("register.chatworkTokenRequired")); return; }
              if (!authChatworkRoomId.trim()) { setAuthError(t("register.chatworkRoomRequired")); return; }
            }

            setAuthSaving(true);
            try {
              const data: UpdateAuthMethodData = { auth_method: authMethod };
              if (authMethod === "password") data.password = authPassword;
              if (authMethod === "2fa_chatwork") {
                data.chatwork_room_id = authChatworkRoomId.trim();
                data.chatwork_api_token = authChatworkApiToken.trim();
              }
              await updateAuthMethod(data);
              setAuthMsg(t("settings.authMethodSaved"));
              setAuthPassword("");
              setAuthPasswordConfirm("");
            } catch {
              setAuthError(t("settings.authMethodFailed"));
            } finally {
              setAuthSaving(false);
            }
          }}
          disabled={authSaving || authMethod === user?.auth_method && authMethod !== "2fa_chatwork"}
          className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {authSaving ? t("settings.authMethodSaving") : t("settings.authMethodSave")}
        </button>

        {authMsg && (
          <p className="text-sm text-green-600 mt-3">{authMsg}</p>
        )}
        {authError && (
          <p className="text-sm text-red-600 mt-3">{authError}</p>
        )}
      </section>

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

        <WeightPresetSelector weights={metricWeights} onChange={setMetricWeights} />
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

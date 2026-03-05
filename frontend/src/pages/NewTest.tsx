import { useState, useEffect, useMemo, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createTest, getSettings, listTemplates, saveTemplate } from "../api/client";
import { DEFAULT_WEIGHTS } from "../api/types";
import type { TestTemplate } from "../api/types";
import WeightPresetSelector from "../components/WeightPresetSelector";
import CalendarPicker from "../components/CalendarPicker";
import { useT } from "../i18n/I18nContext";
import { useAuth } from "../context/AuthContext";

const ALL_LABELS = ["A", "B", "C", "D"];

export default function NewTest() {
  const navigate = useNavigate();
  const t = useT();
  const { user } = useAuth();
  const [videoId, setVideoId] = useState("");
  const [numPatterns, setNumPatterns] = useState(3);
  const [files, setFiles] = useState<(File | null)[]>([null, null, null, null]);
  const [previews, setPreviews] = useState<(string | null)[]>([null, null, null, null]);
  const [rotationInterval, setRotationInterval] = useState(30);
  const [cycles, setCycles] = useState(1);
  const [scheduledStart, setScheduledStart] = useState("");
  const [metricWeights, setMetricWeights] = useState<Record<string, number>>({ ...DEFAULT_WEIGHTS });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Feature 3: Multi-day
  const [testMode, setTestMode] = useState<"single" | "multi_day">("single");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [dailyStartTime, setDailyStartTime] = useState("14:00");

  // Templates
  const [templates, setTemplates] = useState<TestTemplate[]>([]);
  const [templateMsg, setTemplateMsg] = useState("");

  const loadTemplates = () => {
    listTemplates().then(setTemplates).catch(() => {});
  };

  const handleTemplateSelect = (name: string) => {
    const tpl = templates.find((t) => t.name === name);
    if (!tpl) return;
    setNumPatterns(tpl.num_patterns);
    setRotationInterval(tpl.rotation_interval);
    setCycles(tpl.cycles);
    if (tpl.metric_weights && Object.keys(tpl.metric_weights).length > 0) {
      setMetricWeights(tpl.metric_weights);
    }
    setTestMode(tpl.test_mode as "single" | "multi_day");
    if (tpl.daily_start_time) setDailyStartTime(tpl.daily_start_time);
  };

  const handleSaveTemplate = async () => {
    const name = prompt(t("template.saveName"));
    if (!name?.trim()) return;
    setTemplateMsg("");
    try {
      await saveTemplate({
        name: name.trim(),
        num_patterns: numPatterns,
        rotation_interval: rotationInterval,
        cycles,
        metric_weights: metricWeights,
        test_mode: testMode,
        daily_start_time: dailyStartTime,
      });
      setTemplateMsg(t("template.saved", { name: name.trim() }));
      loadTemplates();
      setTimeout(() => setTemplateMsg(""), 3000);
    } catch {
      setTemplateMsg(t("template.saveFailed"));
    }
  };

  // Load defaults from user settings + templates
  useEffect(() => {
    getSettings()
      .then((s) => {
        setRotationInterval(s.default_rotation_interval);
        setCycles(s.default_cycles);
        setNumPatterns(s.default_num_patterns);
        if (s.default_start_time) setScheduledStart(s.default_start_time);
        if (s.default_metric_weights && Object.keys(s.default_metric_weights).length > 0) {
          setMetricWeights(s.default_metric_weights);
        }
      })
      .catch(() => {});
    loadTemplates();
  }, []);

  const labels = ALL_LABELS.slice(0, numPatterns);

  // Auto-calculate end time: all rotations + 5 min buffer
  const totalTestMinutes = rotationInterval * numPatterns * cycles;
  const totalWithBuffer = totalTestMinutes + 5;

  const scheduledEnd = useMemo(() => {
    if (!scheduledStart) return "";
    const start = new Date(scheduledStart);
    const end = new Date(start.getTime() + totalWithBuffer * 60000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
  }, [scheduledStart, totalWithBuffer]);

  const handleFile = (index: number, file: File | null) => {
    const newFiles = [...files];
    newFiles[index] = file;
    setFiles(newFiles);

    const newPreviews = [...previews];
    if (file) {
      newPreviews[index] = URL.createObjectURL(file);
    } else {
      newPreviews[index] = null;
    }
    setPreviews(newPreviews);
  };

  const handlePatternChange = (n: number) => {
    setNumPatterns(n);
    // Clear file/preview for removed slots
    if (n < 4) {
      const newFiles = [...files];
      const newPreviews = [...previews];
      for (let i = n; i < 4; i++) {
        newFiles[i] = null;
        newPreviews[i] = null;
      }
      setFiles(newFiles);
      setPreviews(newPreviews);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!videoId.trim()) {
      setError(t("newTest.videoIdRequired"));
      return;
    }
    const activeFiles = files.slice(0, numPatterns);
    if (activeFiles.some((f) => !f)) {
      setError(t("newTest.allThumbnailsRequired"));
      return;
    }

    if (testMode === "multi_day" && selectedDays.length === 0) {
      setError(t("newTest.multiDayRequired"));
      return;
    }

    setSubmitting(true);
    try {
      const test = await createTest(
        videoId.trim(),
        activeFiles as File[],
        rotationInterval,
        testMode === "single" ? (scheduledStart || undefined) : undefined,
        testMode === "single" ? (scheduledEnd || undefined) : undefined,
        metricWeights,
        testMode,
        testMode === "multi_day" ? selectedDays : undefined,
        testMode === "multi_day" ? dailyStartTime : undefined,
      );
      navigate(`/tests/${test.id}`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : t("newTest.createFailed");
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{t("newTest.title")}</h1>

      {user && !user.youtube_connected && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded mb-4 text-sm flex items-center justify-between">
          <span>{t("newTest.youtubeNotConnected")}</span>
          <a href="/settings" className="text-indigo-600 hover:text-indigo-800 font-medium underline ml-2">
            {t("newTest.goToSettings")}
          </a>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Template Selector */}
        {templates.length > 0 && (
          <div className="bg-indigo-50 rounded-lg p-4">
            <label className="block text-sm font-medium text-indigo-700 mb-1">
              {t("template.select")}
            </label>
            <select
              onChange={(e) => e.target.value && handleTemplateSelect(e.target.value)}
              defaultValue=""
              className="border border-indigo-200 rounded px-3 py-2 text-sm w-full focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              <option value="">{t("template.none")}</option>
              {templates.map((tpl) => (
                <option key={tpl.name} value={tpl.name}>
                  {tpl.name} ({t("template.summary", {
                    patterns: String(tpl.num_patterns),
                    interval: String(tpl.rotation_interval),
                    cycles: String(tpl.cycles),
                  })})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("newTest.videoId")}
          </label>
          <input
            type="text"
            value={videoId}
            onChange={(e) => setVideoId(e.target.value)}
            placeholder={t("newTest.videoIdPlaceholder")}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Test Mode Toggle (Feature 3) */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t("newTest.testModeLabel")}</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTestMode("single")}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                testMode === "single"
                  ? "bg-indigo-600 text-white"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {t("newTest.modeSingle")}
            </button>
            <button
              type="button"
              onClick={() => setTestMode("multi_day")}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                testMode === "multi_day"
                  ? "bg-indigo-600 text-white"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {t("newTest.modeMultiDay")}
            </button>
          </div>
        </div>

        {/* Multi-day calendar (Feature 3) */}
        {testMode === "multi_day" && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">{t("newTest.multiDaySettings")}</h3>
            <div className="flex gap-6">
              <CalendarPicker
                selectedDays={selectedDays}
                onChange={setSelectedDays}
                maxDays={7}
              />
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("newTest.dailyStartTime")}
                  </label>
                  <input
                    type="time"
                    value={dailyStartTime}
                    onChange={(e) => setDailyStartTime(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                {selectedDays.length > 0 && (
                  <div className="bg-indigo-50 rounded px-3 py-2 text-sm text-indigo-700">
                    {t("newTest.multiDaySummary", {
                      time: dailyStartTime,
                      days: selectedDays.join(", "),
                      count: String(selectedDays.length),
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Schedule Settings */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">{t("newTest.scheduleSettings")}</h3>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("newTest.numPatterns")}
              </label>
              <select
                value={numPatterns}
                onChange={(e) => handlePatternChange(Number(e.target.value))}
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value={2}>2 (A / B)</option>
                <option value={3}>3 (A / B / C)</option>
                <option value={4}>4 (A / B / C / D)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {t("newTest.numPatternsHelp")}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("newTest.rotationInterval")}
              </label>
              <select
                value={rotationInterval}
                onChange={(e) => setRotationInterval(Number(e.target.value))}
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value={5}>5 min</option>
                <option value={10}>10 min</option>
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={60}>60 min</option>
                <option value={120}>120 min</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {t("newTest.rotationHelp")}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("newTest.cycles")}
              </label>
              <select
                value={cycles}
                onChange={(e) => setCycles(Number(e.target.value))}
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {t("newTest.cyclesHelp")}
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-indigo-50 rounded px-3 py-2 text-sm text-indigo-700">
            {t("newTest.summary", {
              interval: rotationInterval,
              variants: numPatterns,
              cycles,
              total: totalTestMinutes,
            })}
          </div>

          {/* Start Time (single mode only) */}
          {testMode === "single" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("newTest.startTime")}
                </label>
                <input
                  type="datetime-local"
                  value={scheduledStart}
                  onChange={(e) => setScheduledStart(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t("newTest.emptyStart")}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("newTest.endTimeLabel")}
                </label>
                <input
                  type="datetime-local"
                  value={scheduledEnd}
                  readOnly
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-gray-100 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t("newTest.endTimeAuto")}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Metric Weights */}
        <div className="bg-gray-50 rounded-lg p-4">
          <WeightPresetSelector weights={metricWeights} onChange={setMetricWeights} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("newTest.thumbnailImages")}
          </label>
          <div className={`grid gap-4 ${numPatterns === 2 ? "grid-cols-2" : numPatterns === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
            {labels.map((label, i) => (
              <div key={label} className="space-y-2">
                <div className="text-center text-sm font-medium">
                  {t("newTest.variant", { label })}
                </div>
                {previews[i] ? (
                  <img
                    src={previews[i]!}
                    alt={t("newTest.variant", { label })}
                    className="w-full aspect-video object-cover rounded border border-gray-200"
                  />
                ) : (
                  <div className="w-full aspect-video bg-gray-100 rounded border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs">
                    {t("newTest.clickToUpload")}
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleFile(i, e.target.files?.[0] ?? null)
                  }
                  className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="bg-indigo-600 text-white px-6 py-2 rounded text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? t("newTest.creating")
              : testMode === "multi_day"
                ? t("newTest.scheduleMultiDay")
                : scheduledStart
                  ? t("newTest.scheduleTest")
                  : t("newTest.startTest")}
          </button>
          <button
            type="button"
            onClick={handleSaveTemplate}
            className="border border-indigo-300 text-indigo-600 px-4 py-2 rounded text-sm hover:bg-indigo-50"
          >
            {t("template.saveBtn")}
          </button>
        </div>
        {templateMsg && (
          <p className="text-sm text-green-600">{templateMsg}</p>
        )}
      </form>
    </div>
  );
}

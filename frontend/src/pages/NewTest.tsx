import { useState, useEffect, useMemo, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createTest, getSettings } from "../api/client";
import { DEFAULT_WEIGHTS } from "../api/types";
import WeightSliders from "../components/WeightSliders";
import { useT } from "../i18n/I18nContext";

const ALL_LABELS = ["A", "B", "C", "D"];

export default function NewTest() {
  const navigate = useNavigate();
  const t = useT();
  const [videoId, setVideoId] = useState("");
  const [numPatterns, setNumPatterns] = useState(3);
  const [files, setFiles] = useState<(File | null)[]>([null, null, null, null]);
  const [previews, setPreviews] = useState<(string | null)[]>([null, null, null, null]);
  const [rotationInterval, setRotationInterval] = useState(30);
  const [cycles, setCycles] = useState(1);
  const [scheduledStart, setScheduledStart] = useState("");
  const [metricWeights, setMetricWeights] = useState<Record<string, number>>({ ...DEFAULT_WEIGHTS });
  const [showWeights, setShowWeights] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Load defaults from user settings
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

    setSubmitting(true);
    try {
      const test = await createTest(
        videoId.trim(),
        activeFiles as File[],
        rotationInterval,
        scheduledStart || undefined,
        scheduledEnd || undefined,
        metricWeights,
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

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
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

          {/* Start Time */}
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
        </div>

        {/* Metric Weights */}
        <div className="bg-gray-50 rounded-lg p-4">
          <button
            type="button"
            onClick={() => setShowWeights(!showWeights)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 w-full"
          >
            <span className={`transition-transform ${showWeights ? "rotate-90" : ""}`}>
              &#9654;
            </span>
            {t("newTest.metricWeights")}
          </button>
          {showWeights && (
            <div className="mt-4">
              <WeightSliders weights={metricWeights} onChange={setMetricWeights} />
            </div>
          )}
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

        <button
          type="submit"
          disabled={submitting}
          className="bg-indigo-600 text-white px-6 py-2 rounded text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting
            ? t("newTest.creating")
            : scheduledStart
              ? t("newTest.scheduleTest")
              : t("newTest.startTest")}
        </button>
      </form>
    </div>
  );
}

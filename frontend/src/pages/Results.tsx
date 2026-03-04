import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getResults,
  fetchAnalytics,
  getHeatmap,
  getSignificance,
  getDegradation,
  toggleDegradation,
  downloadReport,
} from "../api/client";
import type {
  TestResult,
  HeatmapData,
  SignificanceData,
  DegradationData,
} from "../api/types";
import VelocityChart from "../components/VelocityChart";
import HeatmapGrid from "../components/HeatmapGrid";
import { useT } from "../i18n/I18nContext";
import { useAuth } from "../context/AuthContext";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";

const VARIANT_COLORS = ["#6366f1", "#f59e0b", "#10b981"];

export default function Results() {
  const { id } = useParams<{ id: string }>();
  const testId = Number(id);
  const t = useT();
  const { user } = useAuth();
  const isPro = user?.plan === "pro" || user?.trial_active === true;
  const [pdfLoading, setPdfLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fetchingAnalytics, setFetchingAnalytics] = useState(false);
  const [analyticsMsg, setAnalyticsMsg] = useState("");

  // Feature 1: Heatmap
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);

  // Feature 2: Significance
  const [significance, setSignificance] = useState<SignificanceData | null>(null);

  // Feature 4: Degradation
  const [degradation, setDegradation] = useState<DegradationData | null>(null);

  const loadResults = () => {
    setLoading(true);
    getResults(testId)
      .then(setResult)
      .catch((err) => setError(err.message || "Failed to load results"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadResults();
    // Load additional data in parallel
    getHeatmap(testId).then(setHeatmap).catch(() => {});
    getSignificance(testId).then(setSignificance).catch(() => {});
    getDegradation(testId).then(setDegradation).catch(() => {});
  }, [testId]);

  const handleFetchAnalytics = async () => {
    setFetchingAnalytics(true);
    setAnalyticsMsg("");
    try {
      await fetchAnalytics(testId);
      setAnalyticsMsg(t("results.analyticsFetched"));
      setTimeout(loadResults, 500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch analytics";
      setAnalyticsMsg(`${t("common.error")}: ${msg}`);
    } finally {
      setFetchingAnalytics(false);
    }
  };

  const handleToggleDegradation = async () => {
    try {
      await toggleDegradation(testId);
      getDegradation(testId).then(setDegradation).catch(() => {});
    } catch {
      // ignore
    }
  };

  if (loading) return <p className="text-gray-500">{t("common.loading")}</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!result) return <p className="text-red-500">{t("results.noResults")}</p>;

  // Prepare radar chart data
  const metricKeys = Object.keys(result.weights).filter(
    (k) => result.weights[k] > 0 && (k === "view_velocity" || result.has_analytics)
  );
  const radarData = metricKeys.map((key) => {
    const entry: Record<string, string | number> = {
      metric: t(`metric.${key}`).replace(/ \(.*\)/, ""),
    };
    result.variants.forEach((v) => {
      entry[v.label] = Math.round(v.metrics[key]?.normalized ?? 0);
    });
    return entry;
  });

  // Composite score bar data
  const scoreData = result.variants.map((v) => ({
    label: t("newTest.variant", { label: v.label }),
    score: Math.round(v.composite_score * 10) / 10,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("results.title", { id: result.test_id })}</h1>
        <div className="flex items-center gap-3">
          {isPro ? (
            <button
              onClick={async () => {
                setPdfLoading(true);
                try {
                  await downloadReport(testId);
                } catch {
                  alert(t("report.downloadFailed"));
                } finally {
                  setPdfLoading(false);
                }
              }}
              disabled={pdfLoading}
              className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {pdfLoading ? t("report.downloading") : t("report.downloadBtn")}
            </button>
          ) : (
            <span className="text-xs text-amber-600 bg-amber-50 px-3 py-1 rounded">
              {t("report.proOnlyBadge")}
            </span>
          )}
          <Link
            to={`/tests/${result.test_id}`}
            className="text-indigo-600 hover:underline text-sm"
          >
            {t("results.backToDetail")}
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-sm text-gray-500 mb-1">{t("results.video")}</p>
        <p className="font-medium">{result.video_title}</p>
      </div>

      {/* Winner banner */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <p className="text-green-600 text-sm font-medium mb-1">{t("results.winner")}</p>
        <p className="text-3xl font-bold text-green-700">
          {t("newTest.variant", { label: result.winner.label })}
        </p>
        <p className="text-green-600 mt-1">
          {t("results.compositeScore", { score: result.winner.composite_score.toFixed(1) })}
          {result.winner.improvement_pct > 0 &&
            t("results.vsWorst", { pct: result.winner.improvement_pct.toFixed(1) })}
        </p>
      </div>

      {/* Feature 2: Significance badges */}
      {significance && significance.pairs.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 space-y-3">
          <h2 className="font-semibold">{t("significance.title")}</h2>
          <div className="flex flex-wrap gap-2">
            {significance.overall_confident ? (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                {t("significance.confident")}
              </span>
            ) : significance.pairs.some((p) => p.confidence_pct >= 80) ? (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700">
                {t("significance.lowConfidence")}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-500">
                {t("significance.insufficient")}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t("significance.colPair")}</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">p-value</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t("significance.colConfidence")}</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">{t("significance.colBetter")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {significance.pairs.map((p) => (
                  <tr key={`${p.variant_a}-${p.variant_b}`}>
                    <td className="px-3 py-2">{p.variant_a} vs {p.variant_b}</td>
                    <td className="px-3 py-2 text-right font-mono">{p.p_value.toFixed(3)}</td>
                    <td className="px-3 py-2 text-right font-mono">{p.confidence_pct}%</td>
                    <td className="px-3 py-2 text-center">
                      {p.significant ? (
                        <span className="text-green-600 font-medium">{p.better_variant}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Analytics fetch button */}
      {!result.has_analytics && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-800">
                {t("results.analyticsNotAvailable")}
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                {t("results.analyticsDelay")}
              </p>
            </div>
            <button
              onClick={handleFetchAnalytics}
              disabled={fetchingAnalytics}
              className="bg-yellow-600 text-white px-4 py-2 rounded text-sm hover:bg-yellow-700 disabled:opacity-50"
            >
              {fetchingAnalytics ? t("results.fetching") : t("results.fetchAnalytics")}
            </button>
          </div>
          {analyticsMsg && (
            <p className="text-xs mt-2 text-yellow-700">{analyticsMsg}</p>
          )}
        </div>
      )}

      {/* Composite Score Chart */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold mb-4">{t("results.compositeScoreChart")}</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={scoreData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} />
            <YAxis type="category" dataKey="label" width={80} />
            <Tooltip />
            <Bar dataKey="score" fill="#6366f1" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Radar Chart */}
      {radarData.length > 2 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-4">{t("results.radarChart")}</h2>
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
              {result.variants.map((v, i) => (
                <Radar
                  key={v.variant_id}
                  name={t("newTest.variant", { label: v.label })}
                  dataKey={v.label}
                  stroke={VARIANT_COLORS[i % VARIANT_COLORS.length]}
                  fill={VARIANT_COLORS[i % VARIANT_COLORS.length]}
                  fillOpacity={0.15}
                />
              ))}
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* View Velocity Chart */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold mb-4">{t("results.avgVelocityChart")}</h2>
        <VelocityChart variants={result.variants} />
      </div>

      {/* Feature 1: Heatmap */}
      {heatmap && heatmap.variants.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-4">{t("heatmap.title")}</h2>
          <HeatmapGrid variants={heatmap.variants} />
        </div>
      )}

      {/* Metric detail table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold">{t("results.metricDetail")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  {t("results.colMetric")}
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  {t("results.colWeight")}
                </th>
                {result.variants.map((v) => (
                  <th
                    key={v.variant_id}
                    className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase"
                  >
                    {t("results.colRaw", { label: v.label })}
                  </th>
                ))}
                {result.variants.map((v) => (
                  <th
                    key={`n-${v.variant_id}`}
                    className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase"
                  >
                    {t("results.colScore", { label: v.label })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {Object.entries(result.weights).map(([key, weight]) => {
                const active = key === "view_velocity" || result.has_analytics;
                return (
                  <tr
                    key={key}
                    className={!active ? "opacity-40" : ""}
                  >
                    <td className="px-4 py-2 text-sm">
                      {t(`metric.${key}`)}
                      {!active && (
                        <span className="text-xs text-gray-400 ml-1">{t("results.noDataTag")}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-mono">
                      {weight}
                    </td>
                    {result.variants.map((v) => {
                      const ms = v.metrics[key];
                      return (
                        <td
                          key={v.variant_id}
                          className="px-4 py-2 text-sm text-right font-mono"
                        >
                          {ms ? formatRaw(key, ms.raw_value) : "-"}
                        </td>
                      );
                    })}
                    {result.variants.map((v) => {
                      const ms = v.metrics[key];
                      return (
                        <td
                          key={`n-${v.variant_id}`}
                          className="px-4 py-2 text-sm text-right font-mono"
                        >
                          {ms ? ms.weighted.toFixed(1) : "-"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {/* Total row */}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-4 py-2 text-sm" colSpan={2}>
                  {t("results.compositeScoreChart")}
                </td>
                {result.variants.map((v) => (
                  <td key={v.variant_id} className="px-4 py-2 text-sm text-right">
                    -
                  </td>
                ))}
                {result.variants.map((v) => (
                  <td
                    key={`t-${v.variant_id}`}
                    className={`px-4 py-2 text-sm text-right font-mono ${
                      v.is_winner ? "text-green-700" : ""
                    }`}
                  >
                    {v.composite_score.toFixed(1)}
                    {v.is_winner && " *"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Variant comparison */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold">{t("results.variantSummary")}</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                {t("results.colVariant")}
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                {t("results.colScoreVal")}
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                {t("results.colVelocity")}
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                {t("results.colMeasurements")}
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                {t("results.colViewsGained")}
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                {t("results.colImprovement")}
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                {t("results.colResult")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {result.variants.map((v) => (
              <tr
                key={v.variant_id}
                className={v.is_winner ? "bg-green-50" : ""}
              >
                <td className="px-4 py-3 text-sm font-medium">{v.label}</td>
                <td className="px-4 py-3 text-sm text-right font-mono">
                  {v.composite_score.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  {v.avg_velocity.toFixed(1)} views/h
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  {v.measurement_count}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  +{v.total_views_gained.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  {v.improvement_pct > 0
                    ? `+${v.improvement_pct.toFixed(1)}%`
                    : "-"}
                </td>
                <td className="px-4 py-3 text-sm text-center">
                  {v.is_winner && (
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
                      {t("results.winnerBadge")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Feature 4: Degradation Tracker */}
      {degradation && (
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t("degradation.title")}</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={degradation.tracking_enabled}
                onChange={handleToggleDegradation}
                className="rounded border-gray-300"
              />
              {t("degradation.trackingLabel")}
            </label>
          </div>

          {degradation.alert && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
              {degradation.alert}
            </div>
          )}

          {degradation.checks.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={degradation.checks.map((c) => ({
                day: c.day_number,
                velocity: c.velocity_24h,
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" label={{ value: t("degradation.xAxis"), position: "insideBottom", offset: -5 }} />
                <YAxis label={{ value: "v/h", angle: -90, position: "insideLeft" }} />
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)} v/h`} />
                <ReferenceLine
                  y={degradation.avg_test_velocity}
                  stroke="#f59e0b"
                  strokeDasharray="5 5"
                  label={t("degradation.testAvg")}
                />
                <Line type="monotone" dataKey="velocity" stroke="#6366f1" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400">{t("degradation.noData")}</p>
          )}
        </div>
      )}
    </div>
  );
}

function formatRaw(key: string, value: number): string {
  switch (key) {
    case "view_velocity":
      return `${value.toFixed(1)} v/h`;
    case "ctr":
    case "avg_view_percentage":
      return `${value.toFixed(2)}%`;
    case "avg_view_duration":
      return `${value.toFixed(1)}s`;
    case "watch_time":
      return `${value.toFixed(1)}m`;
    case "impressions":
      return value.toLocaleString();
    default:
      return value.toLocaleString();
  }
}

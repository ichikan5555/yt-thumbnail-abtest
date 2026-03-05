import { useEffect, useState } from "react";
import {
  analyzeCompetitor,
  getCompetitorHistory,
  getCompetitorDetail,
} from "../api/client";
import type { CompetitorResult, CompetitorHistoryItem } from "../api/types";
import { useT } from "../i18n/I18nContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

export default function Competitor() {
  const t = useT();
  const [channelId, setChannelId] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<CompetitorResult | null>(null);
  const [history, setHistory] = useState<CompetitorHistoryItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getCompetitorHistory().then(setHistory).catch(() => {});
  }, []);

  const handleAnalyze = async () => {
    if (!channelId.trim()) return;
    setAnalyzing(true);
    setError("");
    setResult(null);
    try {
      const data = await analyzeCompetitor(channelId.trim());
      setResult(data);
      // Refresh history
      getCompetitorHistory().then(setHistory).catch(() => {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("competitor.analyzeFailed");
      setError(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleViewHistory = async (id: number) => {
    try {
      const data = await getCompetitorDetail(id);
      setResult(data);
    } catch {
      // ignore
    }
  };

  const chartData = result
    ? Object.entries(result.category_distribution).map(([cat, count]) => ({
        name: t(`crossAnalysis.cat.${cat}`),
        count,
      }))
    : [];

  let recommendations: string[] = [];
  if (result?.recommendations) {
    try {
      recommendations = JSON.parse(result.recommendations);
    } catch {
      // ignore
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">{t("competitor.title")}</h1>

      {/* Input */}
      <div className="bg-white rounded-lg shadow p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t("competitor.channelIdLabel")}
        </label>
        <input
          type="text"
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          placeholder={t("competitor.channelIdPlaceholder")}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <button
          onClick={handleAnalyze}
          disabled={analyzing || !channelId.trim()}
          className="mt-3 w-full bg-indigo-600 text-white px-4 py-2.5 rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {analyzing ? t("competitor.analyzing") : t("competitor.analyzeBtn")}
        </button>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Channel info */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-2">{result.channel_title}</h2>
            <p className="text-sm text-gray-500">
              {t("competitor.videosAnalyzed", { count: String(result.video_count) })}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500 mb-1">{t("competitor.faceRate")}</p>
              <p className="text-2xl font-bold">{result.face_usage_rate}%</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500 mb-1">{t("competitor.textRate")}</p>
              <p className="text-2xl font-bold">{result.text_usage_rate}%</p>
            </div>
          </div>

          {/* Distribution chart */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="font-semibold mb-4">{t("competitor.distributionChart")}</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Thumbnail grid */}
          {result.videos && result.videos.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="font-semibold mb-3">{t("competitor.thumbnailGrid")}</h2>
              <div className="grid grid-cols-3 gap-3">
                {result.videos.map((v) => (
                  <div key={v.video_id} className="space-y-1">
                    {v.thumbnail_url && (
                      <img
                        src={v.thumbnail_url}
                        alt={v.title}
                        className="w-full aspect-video object-cover rounded"
                      />
                    )}
                    <p className="text-xs text-gray-700 truncate">{v.title}</p>
                    <div className="flex flex-wrap gap-1">
                      {v.categories.map((cat) => (
                        <span
                          key={cat}
                          className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="font-semibold mb-3">{t("competitor.recommendations")}</h2>
              <ul className="space-y-2">
                {recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-indigo-500 mt-0.5">&#x2022;</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-3">{t("competitor.history")}</h2>
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">{h.channel_title || h.channel_id}</span>
                  <span className="text-xs text-gray-500">
                    {h.video_count} videos &middot; {h.created_at ? new Date(h.created_at).toLocaleDateString() : "-"}
                  </span>
                </div>
                <button
                  onClick={() => handleViewHistory(h.id)}
                  className="flex-shrink-0 text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded hover:bg-indigo-200"
                >
                  {t("competitor.viewDetail")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

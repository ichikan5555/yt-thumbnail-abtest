import { useEffect, useState } from "react";
import { getCrossAnalysis, listTests, classifyTestThumbnails } from "../api/client";
import type { CrossAnalysisData, TestSummary } from "../api/types";
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

export default function CrossAnalysis() {
  const t = useT();
  const [data, setData] = useState<CrossAnalysisData | null>(null);
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [analysisData, testsData] = await Promise.all([
        getCrossAnalysis(),
        listTests(),
      ]);
      setData(analysisData);
      setTests(testsData.filter((t) => t.status === "completed"));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleClassify = async (testId: number) => {
    setClassifying(testId);
    try {
      await classifyTestThumbnails(testId);
      await load();
    } catch {
      // ignore
    } finally {
      setClassifying(null);
    }
  };

  if (loading) return <p className="text-gray-500">{t("common.loading")}</p>;

  const chartData = data?.categories.map((c) => ({
    name: t(`crossAnalysis.cat.${c.category}`),
    winRate: c.win_rate,
    count: c.count,
  })) ?? [];

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">{t("crossAnalysis.title")}</h1>

      {data && data.total_tests > 0 ? (
        <>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 mb-1">{t("crossAnalysis.totalTests")}</p>
            <p className="text-2xl font-bold">{data.total_tests}</p>
          </div>

          {/* Win rate chart */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="font-semibold mb-4">{t("crossAnalysis.winRateChart")}</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} unit="%" />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="winRate" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Category cards */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-3">{t("crossAnalysis.categoryTable")}</h2>
            <div className="space-y-2">
              {data.categories.map((c) => (
                <div key={c.category} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm font-medium">{t(`crossAnalysis.cat.${c.category}`)}</span>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">{c.count}{t("crossAnalysis.colCount")}</span>
                    <span className="text-gray-500">{c.wins}{t("crossAnalysis.colWins")}</span>
                    <span className="font-mono font-semibold text-indigo-600 w-14 text-right">{c.win_rate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          {t("crossAnalysis.noData")}
        </div>
      )}

      {/* Classify buttons */}
      {tests.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-3">{t("crossAnalysis.classifyTitle")}</h2>
          <p className="text-sm text-gray-500 mb-3">{t("crossAnalysis.classifyDesc")}</p>
          <div className="space-y-2">
            {tests.map((test) => (
              <div key={test.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm truncate flex-1 min-w-0">#{test.id} — {test.video_title || test.video_id}</span>
                <button
                  onClick={() => handleClassify(test.id)}
                  disabled={classifying === test.id}
                  className="flex-shrink-0 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50"
                >
                  {classifying === test.id ? t("common.loading") : t("crossAnalysis.classifyBtn")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

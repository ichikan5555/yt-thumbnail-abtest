import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listTests } from "../api/client";
import type { TestSummary } from "../api/types";
import StatusBadge from "../components/StatusBadge";
import { useI18n } from "../i18n/I18nContext";

export default function Dashboard() {
  const { lang, t } = useI18n();
  const navigate = useNavigate();
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    listTests()
      .then(setTests)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  const dateLang = lang === "ja" ? "ja-JP" : "en-US";

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString(dateLang, {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDateDisplay = (test: TestSummary) => {
    if (test.started_at) {
      return formatDate(test.started_at);
    }
    if (test.scheduled_start) {
      return formatDate(test.scheduled_start);
    }
    if (test.created_at) {
      return formatDate(test.created_at);
    }
    return "-";
  };

  if (loading) {
    return <p className="text-gray-500">{t("common.loading")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
        <Link
          to="/new"
          className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700"
        >
          {t("dashboard.newTest")}
        </Link>
      </div>

      {tests.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          {t("dashboard.empty")}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t("dashboard.colDate")}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t("dashboard.colVideo")}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t("dashboard.colStatus")}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t("dashboard.colResult")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tests.map((test) => (
                <tr
                  key={test.id}
                  onClick={() => navigate(`/tests/${test.id}`)}
                  className="hover:bg-indigo-50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-4 text-sm text-gray-700 whitespace-nowrap">
                    {getDateDisplay(test)}
                  </td>
                  <td className="px-5 py-4 text-sm max-w-sm">
                    <div className="font-medium text-gray-900 truncate">
                      {test.video_title || test.video_id}
                      {test.test_mode === "multi_day" && (
                        <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">
                          {t("dashboard.multiDay", { current: String((test.current_day_index || 0) + 1), total: String(test.total_days || 1) })}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={test.status} />
                  </td>
                  <td className="px-5 py-4 text-sm">
                    {test.status === "completed" && test.winner_label ? (
                      <div className="flex items-center gap-3">
                        <span className="text-green-700 font-semibold">
                          {t("dashboard.winnerIs", { label: test.winner_label })}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/tests/${test.id}/results`);
                          }}
                          className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded text-xs font-medium hover:bg-indigo-200 transition-colors"
                        >
                          {t("dashboard.viewResults")}
                        </button>
                      </div>
                    ) : test.status === "running" ? (
                      <span className="text-blue-600 text-xs">{t("dashboard.inProgress")}</span>
                    ) : test.status === "pending" ? (
                      <span className="text-gray-400 text-xs">-</span>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

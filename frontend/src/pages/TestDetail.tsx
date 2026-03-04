import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getTest,
  pauseTest,
  resumeTest,
  cancelTest,
} from "../api/client";
import type { TestDetail as TestDetailType, TestEvent } from "../api/types";
import StatusBadge from "../components/StatusBadge";
import ThumbnailPreview from "../components/ThumbnailPreview";
import { useT } from "../i18n/I18nContext";

export default function TestDetail() {
  const { id } = useParams<{ id: string }>();
  const testId = Number(id);
  const t = useT();
  const [test, setTest] = useState<TestDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    getTest(testId)
      .then(setTest)
      .finally(() => setLoading(false));
  }, [testId]);

  // SSE for real-time updates
  useEffect(() => {
    if (!test || !["running", "paused"].includes(test.status)) return;

    const es = new EventSource(`/api/events/tests/${testId}`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      const event: TestEvent = JSON.parse(e.data);
      setTest((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: event.status,
          current_cycle: event.current_cycle,
          current_variant_index: event.current_variant_index,
          variants: prev.variants.map((v) => {
            const updated = event.variants.find((ev) => ev.id === v.id);
            if (updated) {
              return {
                ...v,
                avg_velocity: updated.avg_velocity,
                measurement_count: updated.measurement_count,
              };
            }
            return v;
          }),
        };
      });

      // If terminal state, close SSE and reload full data
      if (["completed", "cancelled", "error"].includes(event.status)) {
        es.close();
        getTest(testId).then(setTest);
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => es.close();
  }, [testId, test?.status]);

  const handleAction = async (action: "pause" | "resume" | "cancel") => {
    setActing(true);
    try {
      const fns = { pause: pauseTest, resume: resumeTest, cancel: cancelTest };
      const updated = await fns[action](testId);
      setTest(updated);
    } catch {
      // Reload on error
      const t = await getTest(testId);
      setTest(t);
    } finally {
      setActing(false);
    }
  };

  if (loading) return <p className="text-gray-500">{t("common.loading")}</p>;
  if (!test) return <p className="text-red-500">{t("detail.notFound")}</p>;

  const rotationOrder = (() => {
    try {
      return JSON.parse(test.rotation_order) as string[];
    } catch {
      return [];
    }
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("detail.title", { id: test.id })}</h1>
        <div className="flex gap-2">
          {test.status === "running" && (
            <button
              onClick={() => handleAction("pause")}
              disabled={acting}
              className="bg-yellow-500 text-white px-3 py-1.5 rounded text-sm hover:bg-yellow-600 disabled:opacity-50"
            >
              {t("detail.pause")}
            </button>
          )}
          {test.status === "paused" && (
            <button
              onClick={() => handleAction("resume")}
              disabled={acting}
              className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 disabled:opacity-50"
            >
              {t("detail.resume")}
            </button>
          )}
          {["running", "paused", "pending"].includes(test.status) && (
            <button
              onClick={() => handleAction("cancel")}
              disabled={acting}
              className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 disabled:opacity-50"
            >
              {t("detail.cancel")}
            </button>
          )}
          {test.status === "completed" && (
            <Link
              to={`/tests/${test.id}/results`}
              className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm hover:bg-indigo-700"
            >
              {t("detail.viewResults")}
            </Link>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoCard label={t("detail.status")} value={<StatusBadge status={test.status} />} />
        <InfoCard
          label={t("detail.video")}
          value={
            <a
              href={`https://www.youtube.com/watch?v=${test.video_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline text-sm"
            >
              {test.video_title || test.video_id}
            </a>
          }
        />
        <InfoCard label={t("detail.cycle")} value={`${test.current_cycle + 1} / ${test.cycles}`} />
        <InfoCard label={t("detail.interval")} value={`${test.rotation_interval} min`} />
        {test.scheduled_start && (
          <InfoCard label={t("detail.scheduledStart")} value={new Date(test.scheduled_start).toLocaleString()} />
        )}
        {test.scheduled_end && (
          <InfoCard label={t("detail.scheduledEnd")} value={new Date(test.scheduled_end).toLocaleString()} />
        )}
        <InfoCard
          label={t("detail.rotation")}
          value={
            <span className="text-sm">
              {rotationOrder.map((label, i) => (
                <span
                  key={i}
                  className={
                    i === test.current_variant_index && test.status === "running"
                      ? "font-bold text-indigo-600"
                      : "text-gray-500"
                  }
                >
                  {i > 0 ? " → " : ""}
                  {label}
                </span>
              ))}
            </span>
          }
        />
      </div>

      {test.error_message && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {test.error_message}
        </div>
      )}

      {/* Thumbnails */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold mb-3">{t("detail.variants")}</h2>
        <div className="grid grid-cols-3 gap-4">
          {test.variants.map((v) => (
            <ThumbnailPreview key={v.id} variant={v} />
          ))}
        </div>
      </div>

      {/* Measurements */}
      {test.measurements.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold">{t("detail.measurements")}</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t("detail.colCycle")}</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t("detail.colVariant")}</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t("detail.colStartViews")}</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t("detail.colEndViews")}</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t("detail.colDuration")}</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t("detail.colVelocity")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {test.measurements.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2 text-sm">{m.cycle + 1}</td>
                  <td className="px-4 py-2 text-sm font-medium">{m.variant_label}</td>
                  <td className="px-4 py-2 text-sm text-right">{m.view_count_start.toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm text-right">
                    {m.view_count_end != null ? m.view_count_end.toLocaleString() : "-"}
                  </td>
                  <td className="px-4 py-2 text-sm text-right">
                    {m.duration_minutes != null ? `${m.duration_minutes.toFixed(0)} min` : "-"}
                  </td>
                  <td className="px-4 py-2 text-sm text-right">
                    {m.velocity != null ? `${m.velocity.toFixed(1)} v/h` : "-"}
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

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div>{value}</div>
    </div>
  );
}

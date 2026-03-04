import { useT } from "../i18n/I18nContext";

const colors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  running: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
  error: "bg-red-200 text-red-800",
  daily_paused: "bg-purple-100 text-purple-700",
};

export default function StatusBadge({ status }: { status: string }) {
  const t = useT();
  const cls = colors[status] ?? "bg-gray-100 text-gray-700";
  const label = t(`status.${status}`);
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

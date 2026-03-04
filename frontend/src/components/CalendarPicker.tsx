import { useState, useMemo } from "react";
import { useT } from "../i18n/I18nContext";

interface Props {
  selectedDays: string[];
  onChange: (days: string[]) => void;
  maxDays?: number;
}

export default function CalendarPicker({ selectedDays, onChange, maxDays = 7 }: Props) {
  const t = useT();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  const pad = (n: number) => String(n).padStart(2, "0");

  const daysInMonth = useMemo(() => {
    return new Date(viewYear, viewMonth + 1, 0).getDate();
  }, [viewYear, viewMonth]);

  const firstDow = useMemo(() => {
    // 0=Sun, adjust to Mon=0
    const d = new Date(viewYear, viewMonth, 1).getDay();
    return d === 0 ? 6 : d - 1;
  }, [viewYear, viewMonth]);

  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const toggleDay = (dateStr: string) => {
    if (selectedDays.includes(dateStr)) {
      onChange(selectedDays.filter((d) => d !== dateStr));
    } else if (selectedDays.length < maxDays) {
      onChange([...selectedDays, dateStr].sort());
    }
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const weekDayLabels = [
    t("calendar.mon"),
    t("calendar.tue"),
    t("calendar.wed"),
    t("calendar.thu"),
    t("calendar.fri"),
    t("calendar.sat"),
    t("calendar.sun"),
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 max-w-xs">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1 hover:bg-gray-100 rounded text-gray-500"
        >
          &lt;
        </button>
        <span className="text-sm font-medium">
          {viewYear} / {pad(viewMonth + 1)}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1 hover:bg-gray-100 rounded text-gray-500"
        >
          &gt;
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDayLabels.map((label) => (
          <div key={label} className="text-center text-[10px] text-gray-400 font-medium">
            {label}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells before first day */}
        {Array.from({ length: firstDow }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
          const isPast = dateStr < todayStr;
          const isSelected = selectedDays.includes(dateStr);
          const isToday = dateStr === todayStr;

          return (
            <button
              key={day}
              type="button"
              disabled={isPast}
              onClick={() => toggleDay(dateStr)}
              className={`w-8 h-8 rounded text-xs flex items-center justify-center transition-colors ${
                isSelected
                  ? "bg-indigo-600 text-white font-bold"
                  : isPast
                    ? "text-gray-300 cursor-not-allowed"
                    : isToday
                      ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium"
                      : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Selection info */}
      <div className="mt-3 text-xs text-gray-500">
        {t("calendar.selected", { count: String(selectedDays.length), max: String(maxDays) })}
      </div>
    </div>
  );
}

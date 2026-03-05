import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  PlusCircleIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  ArrowRightStartOnRectangleIcon,
  SparklesIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { useI18n } from "../i18n/I18nContext";
import { useAuth } from "../context/AuthContext";
import type { Lang } from "../i18n/I18nContext";

const navItems = [
  { to: "/", labelKey: "nav.dashboard" as const, icon: ChartBarIcon },
  { to: "/new", labelKey: "nav.newTest" as const, icon: PlusCircleIcon },
  { to: "/cross-analysis", labelKey: "nav.crossAnalysis" as const, icon: SparklesIcon },
  { to: "/competitor", labelKey: "nav.competitor" as const, icon: EyeIcon },
  { to: "/settings", labelKey: "nav.settings" as const, icon: Cog6ToothIcon },
  { to: "/help", labelKey: "nav.help" as const, icon: QuestionMarkCircleIcon },
];

const langOptions: { value: Lang; label: string }[] = [
  { value: "ja", label: "JPN" },
  { value: "en", label: "ENG" },
];

export default function Layout() {
  const { lang, setLang, t } = useI18n();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* サイドバー */}
      <aside className="w-56 bg-gray-900 text-gray-100 flex flex-col">
        <div className="flex items-center gap-2 px-4 py-5 border-b border-gray-700">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="3" width="14" height="10" rx="2" className="fill-indigo-500" />
            <path d="M5 7h8M5 10h5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M19 8l3-3M19 8l3 3" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" />
            <rect x="6" y="16" width="12" height="5" rx="1.5" className="fill-emerald-500" />
            <path d="M9 18.5h6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div className="flex items-baseline gap-1">
            <span className="font-light text-sm text-gray-300">Thumb</span>
            <span className="font-black text-sm text-white tracking-wider">TEST</span>
            <span className="text-[10px] font-semibold text-indigo-400 uppercase">Pro</span>
          </div>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded text-sm ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "text-gray-300 hover:bg-gray-800"
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>

        {/* User + Lang + Logout */}
        <div className="border-t border-gray-700">
          {user && (
            <div className="px-4 py-2 text-xs text-gray-400 truncate">
              {user.name || user.email}
              {user.plan === "pro" ? (
                <span className="ml-1 px-1.5 py-0.5 bg-indigo-600 text-white rounded text-[10px] uppercase">
                  PRO
                </span>
              ) : user.trial_active ? (
                <span className="ml-1 px-1.5 py-0.5 bg-emerald-700 text-emerald-100 rounded text-[10px]">
                  {t("trial.badge", { days: String(user.trial_days_left) })}
                </span>
              ) : (
                <span className="ml-1 px-1.5 py-0.5 bg-red-800 text-red-200 rounded text-[10px]">
                  {t("trial.expired")}
                </span>
              )}
            </div>
          )}
          <div className="px-4 py-2 flex items-center justify-between">
            <div className="flex gap-1">
              {langOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setLang(opt.value)}
                  className={`px-2 py-1 rounded text-sm ${
                    lang === opt.value
                      ? "bg-indigo-600 text-white"
                      : "text-gray-400 hover:bg-gray-800"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleLogout}
              title={t("auth.logout")}
              className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800"
            >
              <ArrowRightStartOnRectangleIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}

import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BeakerIcon,
  PlusCircleIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  ArrowRightStartOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { useI18n } from "../i18n/I18nContext";
import { useAuth } from "../context/AuthContext";
import type { Lang } from "../i18n/I18nContext";

const navItems = [
  { to: "/", labelKey: "nav.dashboard" as const, icon: ChartBarIcon },
  { to: "/new", labelKey: "nav.newTest" as const, icon: PlusCircleIcon },
  { to: "/settings", labelKey: "nav.settings" as const, icon: Cog6ToothIcon },
  { to: "/help", labelKey: "nav.help" as const, icon: QuestionMarkCircleIcon },
];

const langOptions: { value: Lang; flag: string }[] = [
  { value: "ja", flag: "🇯🇵" },
  { value: "en", flag: "🇬🇧" },
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
          <BeakerIcon className="w-6 h-6 text-indigo-400" />
          <span className="font-bold text-sm">{t("nav.appName")}</span>
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
              <span className="ml-1 px-1.5 py-0.5 bg-gray-800 rounded text-[10px] uppercase">
                {user.plan}
              </span>
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
                  {opt.flag}
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

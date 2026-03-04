import { Link } from "react-router-dom";
import { BeakerIcon } from "@heroicons/react/24/outline";
import { useI18n } from "../i18n/I18nContext";

const sections = [
  { titleKey: "privacy.section1Title", bodyKey: "privacy.section1Body" },
  { titleKey: "privacy.section2Title", bodyKey: "privacy.section2Body" },
  { titleKey: "privacy.section3Title", bodyKey: "privacy.section3Body" },
  { titleKey: "privacy.section4Title", bodyKey: "privacy.section4Body" },
  { titleKey: "privacy.section5Title", bodyKey: "privacy.section5Body" },
  { titleKey: "privacy.section6Title", bodyKey: "privacy.section6Body" },
  { titleKey: "privacy.section7Title", bodyKey: "privacy.section7Body" },
];

export default function Privacy() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <Link to="/lp" className="flex items-center gap-2 w-fit">
          <BeakerIcon className="w-6 h-6 text-indigo-600" />
          <span className="font-bold">{t("nav.appName")}</span>
        </Link>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-2">{t("privacy.title")}</h1>
        <p className="text-sm text-gray-500 mb-8">{t("privacy.lastUpdated")}</p>

        <div className="space-y-8">
          {sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">{t(s.titleKey)}</h2>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{t(s.bodyKey)}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

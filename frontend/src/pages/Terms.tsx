import { Link } from "react-router-dom";
import { BeakerIcon } from "@heroicons/react/24/outline";
import { useI18n } from "../i18n/I18nContext";

const sections = [
  { titleKey: "terms.section1Title", bodyKey: "terms.section1Body" },
  { titleKey: "terms.section2Title", bodyKey: "terms.section2Body" },
  { titleKey: "terms.section3Title", bodyKey: "terms.section3Body" },
  { titleKey: "terms.section4Title", bodyKey: "terms.section4Body" },
  { titleKey: "terms.section5Title", bodyKey: "terms.section5Body" },
  { titleKey: "terms.section6Title", bodyKey: "terms.section6Body" },
  { titleKey: "terms.section7Title", bodyKey: "terms.section7Body" },
  { titleKey: "terms.section8Title", bodyKey: "terms.section8Body" },
];

export default function Terms() {
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
        <h1 className="text-2xl font-bold mb-2">{t("terms.title")}</h1>
        <p className="text-sm text-gray-500 mb-8">{t("terms.lastUpdated")}</p>

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

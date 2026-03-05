import { Link } from "react-router-dom";
import {
  BeakerIcon,
  ArrowPathIcon,
  ChartBarSquareIcon,
  TrophyIcon,
  BellAlertIcon,
  SparklesIcon,
  ClockIcon,
  LanguageIcon,
  CheckIcon,
  CloudArrowUpIcon,
} from "@heroicons/react/24/outline";
import { useI18n } from "../i18n/I18nContext";
import type { Lang } from "../i18n/I18nContext";

const langOptions: { value: Lang; label: string }[] = [
  { value: "ja", label: "JPN" },
  { value: "en", label: "ENG" },
];

/* ─── Feature cards config ─── */
const features = [
  { key: 1, icon: ArrowPathIcon, color: "text-blue-600 bg-blue-100" },
  { key: 2, icon: ChartBarSquareIcon, color: "text-purple-600 bg-purple-100" },
  { key: 3, icon: BellAlertIcon, color: "text-amber-600 bg-amber-100" },
  { key: 4, icon: SparklesIcon, color: "text-pink-600 bg-pink-100" },
  { key: 5, icon: ClockIcon, color: "text-emerald-600 bg-emerald-100" },
  { key: 6, icon: LanguageIcon, color: "text-cyan-600 bg-cyan-100" },
];

/* ─── How-it-works steps ─── */
const steps = [
  { key: 1, icon: CloudArrowUpIcon, color: "bg-indigo-600" },
  { key: 2, icon: ArrowPathIcon, color: "bg-violet-600" },
  { key: 3, icon: TrophyIcon, color: "bg-emerald-600" },
];

/* ─── Pricing feature list ─── */
const allFeatures = (t: (k: string) => string) => [
  t("lp.featureAbTestsUnlimited"),
  t("lp.featureAiAnalysis"),
  t("lp.featurePdfReport"),
  t("lp.featureWeeklyReport"),
  t("lp.featurePublicPage"),
  t("lp.featureNotificationAll"),
  t("lp.featureSchedule"),
  t("lp.featureMultilingual"),
];

export default function Landing() {
  const { lang, setLang, t } = useI18n();

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* ───────── Header ───────── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
          <Link to="/lp" className="flex items-center gap-2">
            <BeakerIcon className="w-7 h-7 text-indigo-600" />
            <span className="font-bold text-lg">{t("nav.appName")}</span>
          </Link>
          <div className="flex items-center gap-4">
            {/* Nav scroll links */}
            <a href="#features" className="hidden sm:inline text-sm text-gray-600 hover:text-gray-900">
              {t("lp.footerFeatures")}
            </a>
            <a href="#pricing" className="hidden sm:inline text-sm text-gray-600 hover:text-gray-900">
              {t("lp.footerPricing")}
            </a>
            {/* Lang */}
            <div className="flex gap-1 border border-gray-200 rounded-full px-1 py-0.5">
              {langOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setLang(opt.value)}
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    lang === opt.value ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Login / Dashboard */}
            <Link
              to="/login"
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              {t("lp.login")}
            </Link>
          </div>
        </div>
      </header>

      {/* ───────── Hero ───────── */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50" />
        <div className="absolute top-20 -left-40 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-200/30 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto text-center px-6 pt-24 pb-20">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight whitespace-pre-line tracking-tight">
            {t("lp.heroTitle")}
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            {t("lp.heroSubtitle")}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-8 py-3.5 rounded-xl text-base font-semibold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all hover:shadow-xl hover:shadow-indigo-300"
            >
              {t("lp.heroCta")}
            </Link>
            <span className="text-sm text-gray-500">{t("lp.heroCtaSub")}</span>
          </div>

          {/* Mock UI preview */}
          <div className="mt-16 mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-gray-50 shadow-2xl shadow-gray-200/60 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 border-b border-gray-200">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="ml-2 text-xs text-gray-400 font-mono">localhost:8888</span>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4">
                {["A", "B", "C"].map((label, i) => (
                  <div key={label} className="rounded-lg overflow-hidden border border-gray-200 bg-white">
                    <div className={`h-24 ${i === 0 ? "bg-gradient-to-br from-indigo-400 to-blue-500" : i === 1 ? "bg-gradient-to-br from-rose-400 to-pink-500" : "bg-gradient-to-br from-emerald-400 to-teal-500"} flex items-center justify-center`}>
                      <span className="text-white text-2xl font-bold">{label}</span>
                    </div>
                    <div className="p-2.5 text-center">
                      <div className="text-xs text-gray-500 mb-1">Pattern {label}</div>
                      <div className={`text-sm font-bold ${i === 1 ? "text-emerald-600" : "text-gray-700"}`}>
                        {i === 0 ? "142" : i === 1 ? "218" : "167"} views/h
                      </div>
                      {i === 1 && (
                        <span className="inline-block mt-1 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">
                          WINNER +53%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── How It Works ───────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-14">{t("lp.howTitle")}</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.key} className="text-center">
                <div className={`w-14 h-14 ${step.color} rounded-2xl flex items-center justify-center mx-auto mb-4 text-white`}>
                  <step.icon className="w-7 h-7" />
                </div>
                <div className="text-xs font-bold text-indigo-600 mb-2">STEP {step.key}</div>
                <h3 className="text-lg font-semibold mb-2">
                  {t(`lp.howStep${step.key}Title`)}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {t(`lp.howStep${step.key}Desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Features ───────── */}
      <section id="features" className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">{t("lp.featuresTitle")}</h2>
          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.key}
                className="p-6 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all bg-white"
              >
                <div className={`w-11 h-11 rounded-xl ${f.color} flex items-center justify-center mb-4`}>
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold mb-2">{t(`lp.feature${f.key}Title`)}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {t(`lp.feature${f.key}Desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Pricing ───────── */}
      <section id="pricing" className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-2">{t("lp.pricingTitle")}</h2>
          <p className="text-center text-gray-600 mb-12">{t("lp.pricingSubtitle")}</p>

          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Free Trial */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 flex flex-col">
              <h3 className="text-lg font-bold">{t("lp.planTrial")}</h3>
              <p className="text-sm text-gray-500 mt-1">{t("lp.planTrialDesc")}</p>
              <div className="mt-4 mb-1">
                <span className="text-4xl font-extrabold">{t("lp.priceTrial")}</span>
              </div>
              <p className="text-sm text-emerald-600 font-medium mb-5">{t("lp.trialPeriod")}</p>
              <Link
                to="/register"
                className="block text-center bg-gray-900 text-white py-2.5 rounded-xl font-medium hover:bg-gray-800 transition-colors"
              >
                {t("lp.planCtaTrial")}
              </Link>
              <ul className="mt-6 space-y-3 flex-1">
                {allFeatures(t).map((feat) => (
                  <li key={feat} className="flex items-center gap-2 text-sm">
                    <CheckIcon className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-gray-700">{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro */}
            <div className="rounded-2xl border-2 border-indigo-600 bg-white p-6 flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                {t("lp.planPopular")}
              </div>
              <h3 className="text-lg font-bold">{t("lp.planPro")}</h3>
              <p className="text-sm text-gray-500 mt-1">{t("lp.planProDesc")}</p>
              <div className="mt-4 mb-6">
                <span className="text-4xl font-extrabold">{t("lp.pricePro")}</span>
                <span className="text-gray-500 text-sm">{t("lp.priceProUnit")}</span>
              </div>
              <Link
                to="/register"
                className="block text-center bg-indigo-600 text-white py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
              >
                {t("lp.planCtaPro")}
              </Link>
              <ul className="mt-6 space-y-3 flex-1">
                {allFeatures(t).map((feat) => (
                  <li key={feat} className="flex items-center gap-2 text-sm">
                    <CheckIcon className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                    <span className="text-gray-700">{feat}</span>
                  </li>
                ))}
                <li className="flex items-center gap-2 text-sm">
                  <CheckIcon className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <span className="text-gray-700 font-medium">{t("lp.featurePriority")}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Final CTA ───────── */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto text-center px-6">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t("lp.ctaTitle")}</h2>
          <p className="text-gray-600 mb-8">{t("lp.ctaSubtitle")}</p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-8 py-3.5 rounded-xl text-base font-semibold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all hover:shadow-xl hover:shadow-indigo-300"
          >
            {t("lp.ctaButton")}
          </Link>
        </div>
      </section>

      {/* ───────── Footer ───────── */}
      <footer className="border-t border-gray-200 bg-gray-50 py-12">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BeakerIcon className="w-5 h-5 text-indigo-600" />
                <span className="font-bold">{t("nav.appName")}</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                {t("lp.heroSubtitle").slice(0, 80)}...
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">{t("lp.footerProduct")}</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#features" className="hover:text-gray-900">{t("lp.footerFeatures")}</a></li>
                <li><a href="#pricing" className="hover:text-gray-900">{t("lp.footerPricing")}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">{t("lp.footerSupport")}</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link to="/help" className="hover:text-gray-900">{t("lp.footerGuide")}</Link></li>
                <li><Link to="/contact" className="hover:text-gray-900">{t("lp.footerContact")}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">{t("lp.footerLegal")}</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link to="/company" className="hover:text-gray-900">{t("lp.footerCompany")}</Link></li>
                <li><Link to="/terms" className="hover:text-gray-900">{t("lp.footerTerms")}</Link></li>
                <li><Link to="/privacy" className="hover:text-gray-900">{t("lp.footerPrivacy")}</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-gray-200 text-center text-xs text-gray-400">
            &copy; 2026 {t("lp.footerCopyright")}
          </div>
        </div>
      </footer>
    </div>
  );
}

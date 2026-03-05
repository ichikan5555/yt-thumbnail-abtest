import { useState } from "react";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { useT } from "../i18n/I18nContext";

interface AccordionItem {
  titleKey: string;
  contentKeys: string[];
}

const sections: AccordionItem[] = [
  {
    titleKey: "help.gettingStarted",
    contentKeys: ["help.gettingStartedContent"],
  },
  {
    titleKey: "help.youtubeConnect",
    contentKeys: [
      "help.youtubeConnectStep1",
      "help.youtubeConnectStep2",
      "help.youtubeConnectStep3",
      "help.youtubeConnectStep4",
      "help.youtubeConnectStep5",
      "help.youtubeConnectStep6",
    ],
  },
  {
    titleKey: "help.createTest",
    contentKeys: [
      "help.createTestStep1",
      "help.createTestStep2",
      "help.createTestStep3",
      "help.createTestStep4",
      "help.createTestStep5",
    ],
  },
  {
    titleKey: "help.duringTest",
    contentKeys: [
      "help.duringTestContent",
      "help.duringTestPause",
      "help.duringTestCancel",
      "help.duringTestTimer",
    ],
  },
  {
    titleKey: "help.readResults",
    contentKeys: ["help.readResultsContent"],
  },
  {
    titleKey: "help.resultsDetail",
    contentKeys: [
      "help.resultsHeatmap",
      "help.resultsSignificance",
      "help.resultsDegradation",
      "help.resultsComposite",
      "help.resultsPdf",
    ],
  },
  {
    titleKey: "help.crossAnalysis",
    contentKeys: [
      "help.crossAnalysisContent",
      "help.crossAnalysisStep1",
      "help.crossAnalysisStep2",
      "help.crossAnalysisStep3",
    ],
  },
  {
    titleKey: "help.competitor",
    contentKeys: [
      "help.competitorContent",
      "help.competitorStep1",
      "help.competitorStep2",
      "help.competitorStep3",
      "help.competitorStep4",
    ],
  },
  {
    titleKey: "help.templates",
    contentKeys: [
      "help.templatesContent",
      "help.templatesStep1",
      "help.templatesStep2",
      "help.templatesStep3",
    ],
  },
  {
    titleKey: "help.notifications",
    contentKeys: ["help.notificationsContent"],
  },
  {
    titleKey: "help.settings",
    contentKeys: ["help.settingsContent"],
  },
  {
    titleKey: "help.backup",
    contentKeys: [
      "help.backupContent",
      "help.backupStep1",
      "help.backupStep2",
      "help.backupStep3",
    ],
  },
  {
    titleKey: "help.faq",
    contentKeys: [
      "help.faqQuota",
      "help.faqQuotaAnswer",
      "help.faqAnalytics",
      "help.faqAnalyticsAnswer",
      "help.faqAccuracy",
      "help.faqAccuracyAnswer",
      "help.faqPatterns",
      "help.faqPatternsAnswer",
      "help.faqMultiDay",
      "help.faqMultiDayAnswer",
      "help.faqSignificance",
      "help.faqSignificanceAnswer",
      "help.faqYouTube",
      "help.faqYouTubeAnswer",
      "help.faqTemplate",
      "help.faqTemplateAnswer",
    ],
  },
];

export default function Help() {
  const t = useT();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{t("help.title")}</h1>

      <div className="space-y-2">
        {sections.map((section, i) => (
          <div
            key={section.titleKey}
            className="bg-white rounded-lg border border-gray-200 overflow-hidden"
          >
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-center gap-2 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <ChevronRightIcon
                className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${
                  openIndex === i ? "rotate-90" : ""
                }`}
              />
              <span className="font-medium text-gray-800">
                {t(section.titleKey)}
              </span>
            </button>

            {openIndex === i && (
              <div className="px-5 pb-4 pl-11 space-y-2">
                {section.contentKeys.map((key) => {
                  const text = t(key);
                  const isQuestion = text.startsWith("Q:");
                  const isAnswer = text.startsWith("A:");
                  return (
                    <p
                      key={key}
                      className={`text-sm leading-relaxed ${
                        isQuestion
                          ? "font-medium text-gray-800 mt-3"
                          : isAnswer
                            ? "text-gray-600 ml-2"
                            : "text-gray-600"
                      }`}
                    >
                      {text}
                    </p>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

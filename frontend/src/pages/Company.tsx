import { Link } from "react-router-dom";
import { BeakerIcon } from "@heroicons/react/24/outline";
import { useT } from "../i18n/I18nContext";

export default function Company() {
  const t = useT();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <Link to="/lp" className="flex items-center gap-2 w-fit">
          <BeakerIcon className="w-6 h-6 text-indigo-600" />
          <span className="font-bold">{t("nav.appName")}</span>
        </Link>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-8">{t("company.title")}</h1>
        <table className="w-full text-sm">
          <tbody>
            {([
              ["company.name", "company.nameValue"],
              ["company.representative", "company.representativeValue"],
              ["company.address", "company.addressValue"],
              ["company.email", "company.emailValue"],
              ["company.established", "company.establishedValue"],
              ["company.business", "company.businessValue"],
            ] as const).map(([labelKey, valueKey]) => (
              <tr key={labelKey} className="border-b border-gray-200">
                <th className="py-3 pr-4 text-left text-gray-600 font-medium w-1/3">{t(labelKey)}</th>
                <td className="py-3 text-gray-800">{t(valueKey)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}

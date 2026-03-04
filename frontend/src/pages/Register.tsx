import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BeakerIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import type { Lang } from "../i18n/I18nContext";

type AuthMethod = "password" | "2fa_chatwork" | "2fa_email";

const langOptions: { value: Lang; flag: string }[] = [
  { value: "ja", flag: "🇯🇵" },
  { value: "en", flag: "🇬🇧" },
];

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { lang, setLang, t } = useI18n();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("password");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [chatworkRoomId, setChatworkRoomId] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) { setError(t("register.emailRequired")); return; }

    if (authMethod === "password") {
      if (password.length < 8) { setError(t("register.passwordMin")); return; }
      if (password !== passwordConfirm) { setError(t("register.passwordMismatch")); return; }
    }
    if (authMethod === "2fa_chatwork" && !chatworkRoomId.trim()) {
      setError(t("register.chatworkRoomRequired")); return;
    }

    setSubmitting(true);
    try {
      await register({
        email: email.trim(),
        name: name.trim(),
        auth_method: authMethod,
        password: authMethod === "password" ? password : undefined,
        chatwork_room_id: authMethod === "2fa_chatwork" ? chatworkRoomId.trim() : undefined,
      });
      navigate("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("400")) {
        setError(t("register.emailTaken"));
      } else {
        setError(t("register.failed"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const authOptions: { value: AuthMethod; labelKey: string; descKey: string }[] = [
    { value: "password", labelKey: "register.methodPassword", descKey: "register.methodPasswordDesc" },
    { value: "2fa_email", labelKey: "register.method2faEmail", descKey: "register.method2faEmailDesc" },
    { value: "2fa_chatwork", labelKey: "register.method2faChatwork", descKey: "register.method2faChatworkDesc" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <Link to="/lp" className="flex items-center gap-2">
          <BeakerIcon className="w-6 h-6 text-indigo-600" />
          <span className="font-bold">{t("nav.appName")}</span>
        </Link>
        <div className="flex gap-1">
          {langOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setLang(opt.value)}
              className={`px-2 py-0.5 rounded-full text-xs ${lang === opt.value ? "bg-indigo-600 text-white" : "text-gray-500"}`}
            >
              {opt.flag}
            </button>
          ))}
        </div>
      </header>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-4 pb-20">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <h1 className="text-2xl font-bold text-center mb-6">{t("register.title")}</h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("register.email")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("register.name")}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Auth Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t("register.authMethod")}</label>
              <div className="space-y-2">
                {authOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      authMethod === opt.value ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="auth_method"
                      value={opt.value}
                      checked={authMethod === opt.value}
                      onChange={() => setAuthMethod(opt.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-800">{t(opt.labelKey)}</div>
                      <div className="text-xs text-gray-500">{t(opt.descKey)}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Password fields */}
            {authMethod === "password" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("register.password")}</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">{t("register.passwordHint")}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("register.passwordConfirm")}</label>
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </>
            )}

            {/* Chatwork room ID */}
            {authMethod === "2fa_chatwork" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("register.chatworkRoomId")}</label>
                <input
                  type="text"
                  value={chatworkRoomId}
                  onChange={(e) => setChatworkRoomId(e.target.value)}
                  placeholder="253108411"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">{t("register.chatworkRoomHint")}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 text-sm"
            >
              {submitting ? t("register.creating") : t("register.submit")}
            </button>

            <p className="text-center text-sm text-gray-500">
              {t("register.hasAccount")}{" "}
              <Link to="/login" className="text-indigo-600 hover:underline font-medium">
                {t("register.login")}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

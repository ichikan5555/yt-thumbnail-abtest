import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BeakerIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import type { Lang } from "../i18n/I18nContext";

type Step = "choose" | "password" | "2fa_send" | "2fa_verify";

const langOptions: { value: Lang; label: string }[] = [
  { value: "ja", label: "JPN" },
  { value: "en", label: "ENG" },
];

export default function Login() {
  const navigate = useNavigate();
  const { login, sendCode, verifyCode } = useAuth();
  const { lang, setLang, t } = useI18n();

  const [step, setStep] = useState<Step>("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [twoFaChannel, setTwoFaChannel] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("400")) {
        setError(t("login.use2fa"));
      } else {
        setError(t("login.invalidCredentials"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendCode = async () => {
    setError("");
    setSubmitting(true);
    try {
      const result = await sendCode(email);
      setTwoFaChannel(result.channel);
      setStep("2fa_verify");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("404")) {
        setError(t("login.accountNotFound"));
      } else if (msg.includes("400")) {
        setError(t("login.usePassword"));
      } else {
        setError(t("login.sendCodeFailed"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await verifyCode(email, code);
      navigate("/");
    } catch {
      setError(t("login.invalidCode"));
    } finally {
      setSubmitting(false);
    }
  };

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
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-4 pb-20">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <h1 className="text-2xl font-bold text-center mb-6">{t("login.title")}</h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {/* Step: Choose method */}
          {step === "choose" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("login.email")}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <button
                onClick={() => email.trim() ? setStep("password") : setError(t("login.emailRequired"))}
                className="w-full bg-gray-900 text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 text-sm"
              >
                {t("login.withPassword")}
              </button>
              <button
                onClick={() => email.trim() ? setStep("2fa_send") : setError(t("login.emailRequired"))}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 text-sm"
              >
                {t("login.with2fa")}
              </button>
              <p className="text-center text-sm text-gray-500">
                {t("login.noAccount")}{" "}
                <Link to="/register" className="text-indigo-600 hover:underline font-medium">
                  {t("login.register")}
                </Link>
              </p>
            </div>
          )}

          {/* Step: Password */}
          {step === "password" && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600">{email}</div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("login.password")}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gray-900 text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 text-sm"
              >
                {submitting ? t("login.loggingIn") : t("login.loginButton")}
              </button>
              <button type="button" onClick={() => { setStep("choose"); setError(""); }} className="w-full text-sm text-gray-500 hover:text-gray-700">
                {t("login.back")}
              </button>
            </form>
          )}

          {/* Step: 2FA Send */}
          {step === "2fa_send" && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600">{email}</div>
              <p className="text-sm text-gray-600">{t("login.2faDescription")}</p>
              <button
                onClick={handleSendCode}
                disabled={submitting}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 text-sm"
              >
                {submitting ? t("login.sending") : t("login.sendCode")}
              </button>
              <button type="button" onClick={() => { setStep("choose"); setError(""); }} className="w-full text-sm text-gray-500 hover:text-gray-700">
                {t("login.back")}
              </button>
            </div>
          )}

          {/* Step: 2FA Verify */}
          {step === "2fa_verify" && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2.5 rounded-lg text-sm">
                {twoFaChannel === "chatwork" ? t("login.codeSentChatwork") : t("login.codeSentEmail")}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("login.codeLabel")}</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={6}
                  pattern="[0-9]{6}"
                  placeholder="123456"
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-center tracking-widest text-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || code.length !== 6}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 text-sm"
              >
                {submitting ? t("login.verifying") : t("login.verify")}
              </button>
              <button type="button" onClick={() => { setStep("2fa_send"); setCode(""); setError(""); }} className="w-full text-sm text-gray-500 hover:text-gray-700">
                {t("login.resend")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

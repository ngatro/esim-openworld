"use client";

import { useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { motion } from "framer-motion";

export default function ContactForm() {
  const { t } = useI18n();
  const { user } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim() || !subject.trim() || !message.trim()) {
      alert(t("support.requiredFields"));
      return;
    }

    setSending(true);
    setStatus("idle");

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name.trim() || null,
          customerEmail: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
        }),
      });

      if (res.ok) {
        setStatus("success");
        setSubject("");
        setMessage("");
        // Keep name/email for future tickets
      } else {
        setStatus("error");
      }
    } catch (err) {
      console.error("Failed to send support ticket:", err);
      setStatus("error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
      <h2 className="text-2xl font-bold text-slate-800 mb-2">{t("support.contactForm")}</h2>
      <p className="text-slate-600 mb-6">{t("support.contactFormDesc")}</p>

      {status === "success" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700"
        >
          {t("support.sentSuccess")}
        </motion.div>
      )}

      {status === "error" && !sending && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700"
        >
          {t("support.sendFailed")}
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
              {t("support.name")}
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("support.namePlaceholder")}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-orange-400 bg-white"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              {t("support.email")} <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("support.emailPlaceholder")}
              required
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-orange-400 bg-white"
            />
          </div>
        </div>

        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-slate-700 mb-1">
            {t("support.subject")} <span className="text-red-500">*</span>
          </label>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("support.subjectPlaceholder")}
            required
            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-orange-400 bg-white"
          />
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1">
            {t("support.message")} <span className="text-red-500">*</span>
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("support.messagePlaceholder")}
            rows={6}
            required
            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-orange-400 bg-white resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={sending}
          className="w-full md:w-auto bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white font-semibold px-8 py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {sending ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              {t("support.sending")}
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-5 8v1a2 2 0 002 2h2a2 2 0 002-2v-1m-4-8l-4-4m0 0l-4 4m4-4v12" />
              </svg>
              {t("support.submit")}
            </>
          )}
        </button>
      </form>
    </div>
  );
}

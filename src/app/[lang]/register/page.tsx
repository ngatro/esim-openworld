"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useUI } from "@/components/providers/UIProvider";
import { useI18n } from "@/components/providers/I18nProvider";

export default function RegisterPage() {
  const { user, loading: authLoading } = useAuth();
  const { openRegister } = useUI();
  const { locale } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        router.push(`/${locale}/`);
      } else {
        openRegister();
        router.push(`/${locale}/`);
      }
    }
  }, [user, authLoading, router, locale, openRegister]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <svg className="w-8 h-8 text-green-600 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <p className="text-slate-600">Redirecting...</p>
      </div>
    </div>
  );
}

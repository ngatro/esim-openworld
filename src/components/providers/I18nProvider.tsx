"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";
import de from "@/messages/de.json";
import fr from "@/messages/fr.json";
import { formatCurrency, LOCALE_TO_CURRENCY, DEFAULT_RATES, type ExchangeRates } from "@/lib/currency";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export type Locale = "en" | "vi" | "de" | "fr";

const translations: Record<Locale, Record<string, unknown>> = {
  en: en as Record<string, unknown>,
  vi: vi as Record<string, unknown>,
  de: de as Record<string, unknown>,
  fr: fr as Record<string, unknown>,
};

export const SUPPORTED_LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
];

const COUNTRY_TO_LOCALE: Record<string, Locale> = {
  US: "en", GB: "en", CA: "en", AU: "en", NZ: "en",
  VN: "vi",
  DE: "de", AT: "de", CH: "de",
  FR: "fr", BE: "fr", LU: "fr",
};

async function detectLocaleFromIP(): Promise<Locale> {
  try {
    const res = await fetch("https://ipapi.co/json/", {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      const countryCode = data.country_code;
      if (countryCode && COUNTRY_TO_LOCALE[countryCode]) {
        return COUNTRY_TO_LOCALE[countryCode];
      }
    }
  } catch {
    // ignore
  }
  return "en";
}

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  isReady: boolean;
  currency: string;
  formatPrice: (usdAmount: number) => string;
  rates: ExchangeRates;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let result: unknown = obj;
  for (const key of keys) {
    if (result && typeof result === "object" && key in result) {
      result = (result as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }
  return typeof result === "string" ? result : path;
}

interface I18nProviderProps {
  children: ReactNode;
  initialRates?: ExchangeRates;
  initialLocale?: Locale;
}

export function I18nProvider({ children, initialRates, initialLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale || "en");
  const [isReady, setIsReady] = useState(false);
  const [rates, setRates] = useState<ExchangeRates>(initialRates || DEFAULT_RATES);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Sync locale with URL param changes (when navigating between language routes)
  useEffect(() => {
    if (initialLocale) {
      setLocaleState(initialLocale);
    }
  }, [initialLocale]);

  useEffect(() => {
    async function initLocale() {
      try {
        const saved = localStorage.getItem("locale");
        if (saved && SUPPORTED_LOCALES.some(l => l.code === saved)) {
          setLocaleState(saved as Locale);
          setIsReady(true);
          return;
        }
      } catch {
        // ignore
      }
      
      const detected = await detectLocaleFromIP();
      setLocaleState(detected);
      setIsReady(true);
    }
    
    initLocale();
  }, []);

// Redirect to correct language URL if detected/saved locale doesn't match URL
  useEffect(() => {
    if (isReady && initialLocale && initialLocale !== locale) {
      const pathMatch = pathname.match(/^\/[a-z]{2}(.*)$/);
      const basePath = pathMatch ? pathMatch[1] : pathname;
      const queryString = searchParams.toString();
      const newPath = `/${locale}${basePath}${queryString ? `?${queryString}` : ""}`;
      router.replace(newPath);
    }
  }, [isReady, initialLocale, locale, router, pathname, searchParams]);

  useEffect(() => {
    async function loadRates() {
      try {
        const res = await fetch("/api/admin/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.currencyRates) {
            setRates({
              USD: 1,
              EUR: data.currencyRates.EUR || 0.92,
              VND: data.currencyRates.VND || 24500,
              GBP: data.currencyRates.GBP || 0.79,
              JPY: data.currencyRates.JPY || 150,
            });
          }
        }
      } catch {
        // use default rates
      }
    }
    loadRates();
  }, []);

  const setLocale = (newLocale: Locale) => {
    if (SUPPORTED_LOCALES.some(l => l.code === newLocale)) {
      setLocaleState(newLocale);
      try {
        localStorage.setItem("locale", newLocale);
      } catch {
        // ignore
      }
    }
  };

  const t = (key: string): string => {
    const currentLocale = isReady ? locale : "en";
    return getNestedValue(translations[currentLocale], key);
  };

  const currency = LOCALE_TO_CURRENCY[locale] || "USD";
  
  const formatPrice = (usdAmount: number): string => {
    return formatCurrency(usdAmount, currency, rates);
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, isReady, currency, formatPrice, rates }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
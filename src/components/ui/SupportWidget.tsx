"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/components/providers/I18nProvider";
import Image from "next/image";


declare global {
  interface Window {
    Tawk_API?: {
      maximize?: () => void;
      hideWidget?: () => void; // Thêm dòng này
      showWidget?: () => void; // Thêm dòng này
      onLoad?: () => void;     // Thêm dòng này
      [key: string]: unknown;
    };
    Tawk_LoadStart?: number;
  }
}

interface TawkSettings {
  tawkPropertyId: string;
  tawkWidgetId: string;
}

export default function SupportWidget() {
  const [phoneNumber, setPhoneNumber] = useState("84912345678");
  const [tawkSettings, setTawkSettings] = useState<TawkSettings>({ tawkPropertyId: "", tawkWidgetId: "" });
  const [supportEmail, setSupportEmail] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();


  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    if (newState && !hasOpened) {
      setHasOpened(true);
    }
  };

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.whatsappNumber) setPhoneNumber(data.whatsappNumber);
        if (data.supportEmail) setSupportEmail(data.supportEmail);
        if (data.tawkPropertyId && data.tawkWidgetId) {
          setTawkSettings({ tawkPropertyId: data.tawkPropertyId, tawkWidgetId: data.tawkWidgetId });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!hasOpened) return;
    if (!tawkSettings.tawkPropertyId || !tawkSettings.tawkWidgetId) return;

    const existing = document.querySelector('script[src*="tawk.to"]');
    if (!existing) {
      // 1. Cấu hình trước khi nạp script
    window.Tawk_API = window.Tawk_API || {};
    
    // Luôn ẩn widget khi vừa nạp xong
    window.Tawk_API.onLoad = function() {
      if (window.Tawk_API?.hideWidget) {
        window.Tawk_API.hideWidget();
      }
    };
      const script = document.createElement("script");
      script.src = "https://embed.tawk.to/" + tawkSettings.tawkPropertyId + "/" + tawkSettings.tawkWidgetId + "?disableCollapsed=true";
      script.async = true;
      script.charset = "utf-8";
      script.setAttribute("crossorigin", "*");
      script.setAttribute("data-auto-invisible", "false");
      document.body.appendChild(script);
    }
  }, [tawkSettings, hasOpened]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (widgetRef.current && !widgetRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const whatsappLink = `https://wa.me/${phoneNumber.replace(/\D/g, "")}`;

  const handleWhatsApp = () => {
    window.open(whatsappLink, "_blank");
    setIsOpen(false);
  };

  const handleLiveChat = () => {
    if (window.Tawk_API && window.Tawk_API.maximize) {
      window.Tawk_API.maximize();
    } else {
      window.open("https://wa.me/" + phoneNumber.replace(/\D/g, ""), "_blank");
    }
    setIsOpen(false);
  };

  return (
    <div ref={widgetRef} className="fixed bottom-24 md:bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="bg-white border border-slate-200 rounded-2xl shadow-xl w-64 mb-3 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3">
              <h3 className="text-white font-semibold text-sm">{t("supportWidget.title")}</h3>
              <p className="text-white/70 text-xs">{t("supportWidget.description")}</p>
            </div>
            <div className="p-2">
              <button
                onClick={handleLiveChat}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-orange-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center group-hover:bg-orange-500 transition-colors">
                  <svg className="w-5 h-5 text-orange-500 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-800">{t("supportWidget.button1")}</p>
                  <p className="text-xs text-slate-500">{t("supportWidget.button1desc")}</p>
                </div>
              </button>

              <button
                onClick={handleWhatsApp}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-green-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-500 transition-colors">
                  <svg className="w-5 h-5 text-green-500 group-hover:text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-800">{t("supportWidget.button2")}</p>
                  <p className="text-xs text-green-600">{t("supportWidget.button2desc")}</p>
                </div>
              </button>

              <a
                href={`mailto:${supportEmail}`}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                  <svg className="w-5 h-5 text-blue-500 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <rect
                        x="3"
                        y="6"
                        width="18"
                        height="12"
                        rx="2"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Envelope flap */}
                      <path
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 7l9 6 9-6"
                      />                  
                    </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-800">{t("supportWidget.button3")}</p>
                  <p className="text-xs text-slate-500">{t("supportWidget.button3desc")}</p>
                </div>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={handleToggle}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        
        aria-label="Open support"
      >
        
        {isOpen ? (
          
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="#f97316">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <Image
            src="/support-icon.svg"
            alt="support"
            width={80}
            height={80}
          />

        )}
      </motion.button>
    </div>
  );
}

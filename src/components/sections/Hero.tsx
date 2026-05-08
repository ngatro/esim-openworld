"use client";
import { motion } from "framer-motion";
import { useI18n } from "@/components/providers/I18nProvider";
import Link from "next/link";
import { useState, useEffect } from "react";

const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1920&q=80",
  "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=80",
  "https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1920&q=80",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&q=80",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80",
  "https://images.unsplash.com/photo-1504214208698-ea1916a2195a?w=1920&q=80",
];

export default function Hero() {
  const { t, locale } = useI18n();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
 <section className="relative pt-32 pb-24 overflow-hidden min-h-[650px] flex items-center">
  {/* 1. Trả lại độ sáng cho ảnh nền để nhìn "dễ chịu" */}
  <div className="absolute inset-0 z-0">
    {HERO_IMAGES.map((src, index) => (
      <div
        key={index}
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          backgroundImage: `url(${src})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: index === currentImageIndex ? 1 : 0,
          filter: "none",
        }}
      />
    ))}
    {/* Overlay nhẹ nhàng hơn, không làm tối thui mà chỉ phủ một lớp kính */}
    <div className="absolute inset-0 bg-slate-900/40 " />
    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent" />
  </div>

  <div className="relative max-w-7xl mx-auto px-6 z-10 w-full text-center">
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
    >
      {/* 2. Badge nhỏ nhắn, xinh xắn */}
      <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 mb-8">
        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        <span className="text-white/90 text-xs font-medium tracking-widest uppercase">
          {t("hero.nowServing")}
        </span>
      </div>
      
      {/* 3. Title thanh thoát, không quá to */}
      <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight tracking-tight">
        {t("hero.title.stayConnected")}
        <span className="text-orange-400"> {t("hero.title.anywhere")} </span>
        {t("hero.title.youGo")}
      </h1>
      
      {/* 4. Subtitle nhẹ nhàng */}
      <p className="text-lg md:text-xl text-white/80 mb-10 max-w-2xl mx-auto font-light leading-relaxed">
        {t("hero.subtitle")}
      </p>
      
      {/* 5. Buttons bo tròn mềm mại */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
        <Link
          href={`/${locale}/plans`}
          className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white font-medium px-8 py-3.5 rounded-full shadow-lg transition-all"
        >
          {t("hero.browsePlans")}
        </Link>
        <a
          href="#how-it-works"
          className="w-full sm:w-auto px-8 py-3.5 rounded-full font-medium text-white border border-white/30 hover:bg-white/10 backdrop-blur-sm transition-all"
        >
          {t("hero.howItWorks")}
        </a>
      </div>

      {/* 6. Hàng cam kết thiết kế tối giản nhất */}
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
        {[
          { text: t("common.noHiddenFees") },
          { text: t("common.instantDelivery") },
          { text: t("common.refundPolicy") }
        ].map((item, index) => (
          <div key={index} className="flex items-center gap-2 text-white/60">
            <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium">{item.text}</span>
          </div>
        ))}
      </div>
    </motion.div>
  </div>
</section>
  );
}

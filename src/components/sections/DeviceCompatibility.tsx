"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import FadeIn from "../animations/FadeIn";
import { useI18n } from "../providers/I18nProvider";
import Link from "next/link";


export default function DeviceCompatibility() {
   const { t, locale } = useI18n();
  const devices = [
    { icon: "📱", name: "iPhone", models: "XS, XS Max, XR, 11, 12, 13, 14, 15, SE (2020+)", supported: true },
    { icon: "📱", name: "Samsung", models: "Galaxy S20, S21, S22, S23, S24, Fold, Flip series", supported: true },
    { icon: "📱", name: "Google Pixel", models: "Pixel 3, 4, 5, 6, 7, 8 series", supported: true },
    { icon: "📱", name: "Other Android", models: "Most phones with eSIM support", supported: true },
    { icon: "💻", name: "iPad", models: "iPad Pro, Air, Mini with cellular", supported: true },
    { icon: "🖥️", name: "Laptops", models: "Windows 11 PCs with eSIM", supported: false },
  ];

  const DEVICE_IMAGES: Record<string, string> = {
    "iPhone": "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600&q=80",
    "Samsung": "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600&q=80",
    "Google Pixel": "https://images.unsplash.com/photo-1598327105666-5b89351aff70?w=600&q=80",
    "Other Android": "https://images.unsplash.com/photo-1607252650355-f7fd0460ccdb?w=600&q=80",
    "iPad": "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&q=80",
    "Laptops": "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&q=80",
  };


  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-800 mb-4">{t("device.title")}</h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">
              {t("device.subtitle")}
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map((device, index) => (
            <FadeIn key={index} delay={index * 0.1}>
              <motion.div 
                className={`bg-white border rounded-2xl overflow-hidden ${device.supported ? 'border-slate-200 hover:border-orange-400 hover:shadow-lg' : 'border-slate-100 opacity-60'}`}
                whileHover={{ scale: 1.02 }}
              >
                <div className="relative h-40 bg-slate-100">
                  <Image
                    src={DEVICE_IMAGES[device.name] || DEVICE_IMAGES["Other Android"]}
                    alt={device.name}
                    fill
                    className="object-cover"
                    unoptimized
                    loading="eager"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-4">
                    <span className="text-3xl">{device.icon}</span>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-slate-800">{device.name}</h3>
                    {device.supported && (
                      <span className="bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-full">Supported</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">{device.models}</p>
                </div>
              </motion.div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.3}>
          <div className="mt-12 bg-orange-50 border border-slate-200 rounded-2xl p-8 text-center">
            <p className="text-slate-600 mb-4">{t("device.notSure")}</p>
            <Link href={`/${locale}/compatibility`} className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium">
              {t("device.checkList")}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
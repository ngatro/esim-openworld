"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useI18n } from "../providers/I18nProvider";

interface Region {
  id: string;
  name: string;
  emoji: string;
  countries?: { id: string; name: string; emoji: string }[];
  _count?: { plans: number };
}

const HOT_COUNTRIES = [
  { code: "JP", name: "Japan", emoji: "🇯🇵" },
  { code: "KR", name: "South Korea", emoji: "🇰🇷" },
  { code: "TH", name: "Thailand", emoji: "🇹🇭" },
  { code: "SG", name: "Singapore", emoji: "🇸🇬" },
  { code: "VN", name: "Vietnam", emoji: "🇻🇳" },
  { code: "US", name: "USA", emoji: "🇺🇸" },
  { code: "GB", name: "UK", emoji: "🇬🇧" },
  { code: "FR", name: "France", emoji: "🇫🇷" },
  { code: "DE", name: "Germany", emoji: "🇩🇪" },
  { code: "AU", name: "Australia", emoji: "🇦🇺" },
];

const REGIONS = [
  { id: "asia", name: "Asia", emoji: "🌏" },
  { id: "europe", name: "Europe", emoji: "🏰" },
  { id: "americas", name: "Americas", emoji: "🌎" },
  { id: "oceania", name: "Oceania", emoji: "🌴" },
  { id: "middle-east", name: "Middle East", emoji: "🕌" },
  { id: "global", name: "Global", emoji: "🌐" },
];

export default function PlansSection() {
  const { t, locale } = useI18n();
  const [regions, setRegions] = useState<Region[]>([]);

  useEffect(() => {
    fetch("/api/regions")
      .then((r) => r.json())
      .then((data) => setRegions(data.regions || []))
      .catch(console.error);
  }, []);

  return (
    <section className="py-16 sm:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-3">{t("plans.title")}</h2>
          <p className="text-slate-600 text-base">{t("plans.subtitle")}</p>
        </div>

        {/* Popular Regions */}
        <div className="mb-10">
          <h3 className="text-lg font-semibold text-slate-700 mb-4 text-center">{t("coverage.popular")}</h3>
          <div className="flex flex-wrap justify-center gap-3">
            {REGIONS.map((region) => (
               <Link key={region.id} href={`/${locale}/esim/${region.name}`}>
                 <motion.div
                   whileHover={{ scale: 1.05 }}
                   whileTap={{ scale: 0.95 }}
                   className="flex items-center gap-2 px-5 py-3 bg-slate-100 hover:bg-orange-100 border border-slate-200 hover:border-orange-300 rounded-xl transition-colors"
                 >
                   <span className="text-xl">{region.emoji}</span>
                   <span className="font-medium text-slate-700">{region.name}</span>
                 </motion.div>
               </Link>
             ))}
           </div>
         </div>

         {/* Hot Countries */}
         <div className="mb-10">
           <h3 className="text-lg font-semibold text-slate-700 mb-4 text-center">{t("coverage.title")}</h3>
           <div className="flex flex-wrap justify-center gap-3">
             {HOT_COUNTRIES.map((country) => (
               <Link key={country.code} href={`/${locale}/esim/${country.code}`}>
                 <motion.div
                   whileHover={{ scale: 1.05 }}
                   whileTap={{ scale: 0.95 }}
                   className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-orange-400 hover:shadow-md rounded-xl transition-all"
                 >
                   <span className="text-xl">{country.emoji}</span>
                   <span className="font-medium text-slate-700 text-sm">{country.name}</span>
                 </motion.div>
               </Link>
             ))}
           </div>
         </div>

         {/* View All Button */}
         <div className="text-center">
           <Link href={`/${locale}/plans`}>
            <motion.button
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-colors shadow-lg"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              {t("hero.browsePlans")} →
            </motion.button>
          </Link>
        </div>
      </div>
    </section>
  );
}
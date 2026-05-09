"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useI18n } from "../providers/I18nProvider";
import FadeIn from "../animations/FadeIn";

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

  const [regions, setRegions] = useState<any[]>([]);
  const [topCountries, setTopCountries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
   useEffect(() => {
      const fetchData = async () => {
        try {
          // Đảm bảo gọi API route chuẩn, nếu vẫn bị loop hãy thử gọi trực tiếp domain hoặc check lại middleware
          const res = await fetch("/api/destinations"); 
          if (!res.ok) throw new Error("Failed to fetch");
          
          const data = await res.json();
  
          const mappedRegions = (data.regions || []).map((r: any) => ({
            id: r.id,
            name: t(`regions.${r.id}`) || r.name,
            countries: "10+", 
            emoji: r.emoji || "🌍",
          }));
  
          const countries = (data.destinations || []).map((d: any) => ({
            id: d.id,
            name: t(`countries.${d.id}`) || d.name,
            emoji: d.emoji || "🌍"
          }));
  
          setRegions(mappedRegions);
          setTopCountries(countries);
        } catch (err) {
          console.error("Fetch error:", err);
        } finally {
          setLoading(false);
        }
      };
  
      fetchData();
      // CHỈ để [t] ở đây, hoặc bỏ trống nếu không muốn nó chạy lại khi t thay đổi
    }, [t]); 

  // const [regions, setRegions] = useState<Region[]>([]);

  // useEffect(() => {
  //   fetch("/api/regions")
  //     .then((r) => r.json())
  //     .then((data) => setRegions(data.regions || []))
  //     .catch(console.error);
  // }, []);

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
            {regions.map((region, index) => (
              <Link key={region.id} href={`/${locale}/esim/${region.id.toLowerCase()}`}>
                  <FadeIn key={index} delay={index * 0.1}>
                    <div className={`flex flex-col items-center p-4 rounded-lg`}>
                      <span className="text-2xl mb-2">
                        {region.emoji}
                        </span>
                      <h3 className="text-lg font-semibold text-slate-800">{region.name}</h3>
                    </div>
                  </FadeIn>
              </Link>
                      ))}
            {/* {REGIONS.map((region) => (
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
             ))} */}
           </div>
         </div>

         {/* Hot Countries */}
        <div className="mb-10">
          <h3 className="text-lg font-semibold text-slate-700 mb-4 text-center">
            {t("coverage.title")}
          </h3>
  
          { /* Chuyển từ flex sang grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {topCountries.map((country, index) => (
              <Link key={country.id} href={`/${locale}/esim/${country.id}`} className="block">
                <FadeIn>
                  <span 
                    className="flex items-center justify-center bg-orange-100 text-slate-700 px-3 py-2.5 rounded-lg text-sm hover:bg-orange-200 hover:text-orange-800 transition-colors cursor-pointer w-full h-full text-center whitespace-nowrap"
                  >
                    <span className="mr-2">{country.emoji}</span>
                    <span className="truncate">{country.name}</span>
                  </span>
                </FadeIn>
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
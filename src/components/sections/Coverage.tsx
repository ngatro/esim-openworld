"use client";

import { motion } from "framer-motion";
import FadeIn from "@/components/animations/FadeIn";
import { useI18n } from "@/components/providers/I18nProvider";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

// CHUYỂN CÁI NÀY RA NGOÀI để không bị tạo mới mỗi lần render
const REGION_COLORS: Record<string, string> = {
  europe: "bg-blue-100",
  asia: "bg-red-100",
  americas: "bg-green-100",
  middleeast: "bg-purple-100",
  africa: "bg-yellow-100",
  oceania: "bg-pink-100",
};

export default function Coverage() {
  const { t, locale } = useI18n();
  const router = useRouter();

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
          flag: r.emoji || "🌍",
          color: REGION_COLORS[r.id] || "bg-gray-100",
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
  
  if (loading) return null; // Hoặc loading spinner

//   return (
//     <section className="py-24 bg-orange-50">
//       {/* ... giữ nguyên phần JSX bên dưới ... */}
//       <div className="flex flex-wrap justify-center gap-3">
//         {topCountries.map((country, index) => (
//           <span 
//             key={country.id || index}
//             onClick={() => router.push(`/${locale}/esim/${country.id}`)} 
//             className="bg-orange-100 text-slate-700 px-4 py-2 rounded-lg text-sm hover:bg-orange-200 hover:text-orange-800 transition-colors cursor-pointer"
//           >
//             {country.emoji} {country.name} 
//           </span>
//         ))}
//       </div>
//     </section>
//   );
// }

  return (
    <section className="py-24 bg-orange-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-800 mb-4">{t("coverage.title")}</h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">
              {t("coverage.subtitle")}
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
          {regions.map((region, index) => (
            <FadeIn key={index} delay={index * 0.1}>
              <div className={`flex flex-col items-center p-4 rounded-lg ${region.color}`}>
                <span
                className="text-4xl mb-2"
                onClick={() => router.push(`/${locale}/esim/${region.id.toLowerCase()}`)} 
                >
                  {region.flag}
                  </span>
                <h3 className="text-lg font-semibold text-slate-800">{region.name}</h3>
                <p className="text-sm text-slate-600">{region.countries}</p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.3}>
          <div className="bg-white border border-slate-200 rounded-2xl p-8">
            <h3 className="text-xl font-bold text-slate-800 mb-4 text-center">{t("coverage.popular")}</h3>
            <div className="flex flex-wrap justify-center gap-3">
              {topCountries.map((country, index) => (
                <span 
                  key={country.id || index}
                  onClick={() => router.push(`/${locale}/esim/${country.id}`)} 
                  className="bg-orange-100 text-slate-700 px-4 py-2 rounded-lg text-sm hover:bg-orange-200 hover:text-orange-800 transition-colors cursor-pointer"
                >
                  {country.emoji} {country.name} 
                </span>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
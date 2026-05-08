"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useI18n } from "@/components/providers/I18nProvider";
import { getDestinationImage, getValidUrl } from "@/lib/unsplash";
import SmartSearchBox from "@/components/ui/SearchBox";

function getCountryEmoji(countryCode: string): string {
  const code = countryCode.toUpperCase();
  if (code.length !== 2) return "🏳️";
  const offset = 127397;
  try {
    return String.fromCodePoint(offset + code.charCodeAt(0)) + String.fromCodePoint(offset + code.charCodeAt(1));
  } catch {
    return "🏳️";
  }
}

interface Destination {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  landmark: string | null;
  imageUrl: string | null;
  isVisible: boolean;
  priority: number;
  isHot?: boolean;
  minPrice?: number | null;
  photoId?: string;
}

interface DestinationRegion {
  id: string;
  name: string;
  emoji: string;
  imageUrl: string | null;
  isVisible: boolean;
  priority: number;
  _count?: { plans: number };
}

// Fetch dynamic image from Unsplash API
async function fetchUnsplashImage(countryName: string): Promise<string> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/unsplash?q=${encodeURIComponent(countryName)}`);
    if (res.ok) {
      const data = await res.json();
      return data.url;
    }
  } catch (error) {
    console.error("Failed to fetch Unsplash image:", error);
  }
  return getDestinationImage(countryName.toLowerCase().replace(/\s+/g, '-'));
}

// Hero image for main page
const HERO_IMAGE = getDestinationImage("global");

interface PlansClientProps {
  params: {
    lang: string;
  };
}

interface Plan {
  id: string;
  name: string;
  slug: string | null;
  packageCode: string;
  destination: string;
  dataAmount: number;
  durationDays: number;
  retailPriceUsd: number;
  networkType: string | null;
  isHot: boolean;
  badge: string | null;
  countryId: string | null;
  countryName: string | null;
}

export default function PlansClient( { params }: PlansClientProps) {
  const { lang } = params;
  const { t ,locale } = useI18n();
  const router = useRouter();
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [regions, setRegions] = useState<DestinationRegion[]>([]);
  const [hotPlans, setHotPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroImage, setHeroImage] = useState<string>(HERO_IMAGE);

  useEffect(() => {
    async function loadData() {
      // Fetch hero image from Unsplash
      const heroUrl = await fetchUnsplashImage("travel");
      setHeroImage(heroUrl);

      const res = await fetch("/api/destinations");
      const data = await res.json();
        
      if (data.destinations && data.destinations.length > 0) {
        setDestinations(data.destinations.map((d: any) => ({
          ...d,
          imageUrl: d.imageUrl || getDestinationImage(d.slug),
          isVisible: true,
          priority: d.priority || 1,
        })) as Destination[]);
      } 
     
      
      if (data.regions && data.regions.length > 0) {
        setRegions(data.regions as DestinationRegion[]);
      } 
      
      // Fetch hot plans for the hot plans section
      try {
        const plansRes = await fetch("/api/plans?isHot=true&limit=20");
        const plansData = await plansRes.json();
        if (plansData.plans && plansData.plans.length > 0) {
          setHotPlans(plansData.plans.map((p: any) => ({
            ...p,
            retailPriceUsd: Number(p.retailPriceUsd) || 0,
            dataAmount: Number(p.dataAmount) || 0,
          })));
        }
      } catch (err) {
        console.error("Failed to fetch hot plans:", err);
      }
      
      setLoading(false);
    }
    
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Hero Section with Dynamic Unsplash Image */}
      <div className="relative h-[50vh] min-h-[400px] ">
        <Image
          src={heroImage}
          alt="Travel Hero"
          fill
          className="object-cover"
          priority
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-[#F8F9FA]" />
        
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 text-center drop-shadow-lg">
            {t("plans.title") || "Browse eSIM Plans"}
          </h1>
          <p className="text-white/90 text-lg md:text-xl mb-8 text-center drop-shadow z-priority">
            {t("plans.subtitle") || "Choose your destination and stay connected"}
          </p>
          <SmartSearchBox />
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10 pb-16">
        
        {/* Hot Plans Section - Show plans where isHot = true */}
        {hotPlans.length > 0 && (
          <div className="mb-16">
            <h2 className="text-2xl font-semibold mb-8 text-slate-700">🔥 {t("plans.hotPlans") || "Các gói cước Hot"}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {hotPlans.slice(0, 8).map((plan) => (
                <Link
                  key={plan.id}
                  href={`/${locale}/esim/${plan.countryName?.toLowerCase().replace(/\s+/g, '-') || 'global'}/${plan.slug || plan.id}`}
                  className="group relative bg-white rounded-[2rem] overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2"
                >
                  <div className="relative h-56 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-orange-500/80 via-orange-500/20 to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center px-4">
                        <div className="text-3xl font-bold text-white drop-shadow-lg mb-2">{plan.dataAmount}GB</div>
                        <div className="text-white/80 text-sm font-medium">{plan.durationDays} {t("plansCard.days")}</div>
                      </div>
                    </div>
                    <div className="absolute top-4 right-4 bg-white text-orange-600 font-bold px-4 py-1.5 rounded-full text-sm shadow-lg">
                      ${plan.retailPriceUsd.toFixed(2)}
                    </div>
                    {plan.badge && (
                      <div className="absolute top-4 left-4 bg-green-500 text-white font-bold px-3 py-1 rounded-full text-xs shadow-lg uppercase">
                        {plan.badge}
                      </div>
                    )}
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{plan.countryName ? getCountryEmoji(plan.countryId || '') : '🌐'}</span>
                        <h3 className="text-lg font-bold text-white drop-shadow-lg truncate">{plan.name}</h3>
                      </div>
                      <p className="text-white/70 text-xs truncate">{plan.networkType}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
        
        {/* Countries Grid - Cards with Unsplash Images */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold mb-8 text-slate-700">🏝️ {t("coverage.popular")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {destinations.slice(0, 16).map((dest) => (
              <Link
                key={dest.id}
                href={`/${locale}/esim/${dest.slug}`}
                className="group relative bg-white rounded-[2rem] overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2"
              >
                <div className="relative h-56 overflow-hidden">
                  <Image
                    src={dest.imageUrl || getDestinationImage(dest.slug)}
                    alt={dest.landmark || dest.name}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-700"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  
                  {dest.minPrice !== undefined && dest.minPrice !== null && (
                    <div className="absolute top-4 right-4 bg-orange-500 text-white font-bold px-4 py-1.5 rounded-full text-sm shadow-lg">
                      {`From ${dest.minPrice.toFixed(2)}`}
                    </div>
                  )}
                  
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{dest.emoji}</span>
                       <h3 className="text-xl font-bold text-white drop-shadow-lg">
                         {dest.id && t(`countries.${dest.id}`) !== `countries.${dest.id}`
                           ? t(`countries.${dest.id}`)
                           : dest.id || dest.name || "Unknown"}
                       </h3>
                    </div>
                    <p className="text-white/80 text-sm font-medium drop-shadow">{dest.landmark}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Regions - Cards with Unsplash Images */}
        <div>
          <h2 className="text-2xl font-semibold mb-8 text-slate-700">🌍 {t("plans.browseByRegions")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {regions.map((region) => (
              <Link
                key={region.id}
                href={`/${locale}/esim/${region.id}`}
                className="group relative bg-white rounded-[2rem] overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2"
              >
                <div className="relative h-36 overflow-hidden">
                  <Image
                    src={region.imageUrl || HERO_IMAGE}
                    alt={region.name}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-700"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
                  
                  <div className="absolute inset-0 flex items-center justify-between px-6">
                    <div className="flex items-center gap-4">
                      <span className="text-4xl">{region.emoji}</span>
                      <div>
                        <h3 className="text-xl font-bold text-white drop-shadow-lg">
                          {region.name} {region.id}
                        </h3>
                        <p className="text-white/70 text-sm">
                          {region._count?.plans || 3} {t("plans.esimPlans")}
                        </p>
                      </div>
                    </div>
                    <svg className="w-8 h-8 text-white/70 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}

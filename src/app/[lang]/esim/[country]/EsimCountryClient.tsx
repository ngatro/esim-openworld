"use client";

import { useEffect, useState, useMemo, use } from "react";
import Image from "next/image";
import { getDestinationImage } from "@/lib/unsplash";
import { useI18n } from "@/components/providers/I18nProvider";
import { motion, AnimatePresence } from "framer-motion";
import EsimDataTypeModal from "./EsimDataTypeModal";
import FadeIn from "@/components/animations/FadeIn";
import PlansCard, { PlanCardConfig } from "./PlansCard";
import Countries from "@/data/country-to-region.json"

interface OperatorInfo {
  operatorName: string;
  networkType: string;
}


interface LocationNetwork {
  locationCode: string;
  locationLogo: string;
  locationName: string;
  operatorList: OperatorInfo[];
}

interface Plan {
  id: string;
  name: string;
  slug: string | null;
  packageCode: string;
  destination: string;
  dataAmount: number;
  dataVolume: number;
  durationDays: number;
  priceUsd: number;
  retailPriceUsd: number;
  speed: string | null;
  networkType: string | null;
  dataType: number;
  coverageCount: number;
  countryId: string | null;
  countryName: string | null;
  regionId: string | null;
  regionName: string | null;
  locations: unknown;
  ipExport: string | null;
  supportTopUp: boolean;
  unusedValidTime: number;
  isPopular: boolean;
  isBestSeller: boolean;
  isHot: boolean;
  badge: string | null;
  locationNetworkList: unknown;
  fupPolicy: string | null;
  smsStatus: number;
  activeType: number;
  supportTopUpType: number;
  topupPackageId?: number;
  


}

// Grouped plan for display
interface GroupedPlan {
  key: string;
  destination: string;
  countryId?: string | undefined | null;
  fupPolicy: string | null;
  plans: Plan[];
  minPrice: number;
  maxPrice: number;
  dataType: number;
}

const regions = ["global", "asia", "europe", "americas", "oceania"];

const countryNameToSlug = (str: string) =>
  str
    .toLowerCase()
    .normalize("NFD") // xử lý dấu
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const slugToCodeMap: Record<string, string> = Object.entries(Countries)
  .reduce((acc, [code, value]) => {
    const slug = countryNameToSlug(value.countryName);
    acc[slug] = code;
    return acc;
  }, {} as Record<string, string>);


async function loadPlans(countrySlug: string): Promise<Plan[]> {
   const normalizedSlug = countryNameToSlug(countrySlug);
  const isRegion = regions.includes(countrySlug.toLowerCase());
  const countryCode =
    slugToCodeMap[normalizedSlug] ??
    (normalizedSlug.length === 2 ? normalizedSlug.toUpperCase() : undefined);

  if (!isRegion && !countryCode) {
    throw new Error(`Invalid country slug: ${countrySlug}`);
  }
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = isRegion 
    ? `${baseUrl}/api/plans?regionId=${countrySlug.toLowerCase()}`
    : `${baseUrl}/api/plans?countryId=${countryCode}`;
  
  const res = await fetch(url);
  if (!res.ok) {
    console.error('Failed to fetch plans:', res.status, res.statusText);
    return [];
  }
  const data = await res.json();
  return data.plans || [];
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


export default function EsimCountryPage({ params }: { params: Promise<{ country: string }> }) {
  const resolvedParams = use(params);
  const { t, formatPrice } = useI18n();
  const [country, setCountry] = useState<string>("");
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroImage, setHeroImage] = useState<string>(getDestinationImage("global"));
  
  const [selectedDuration, setSelectedDuration] = useState<string>("all");
  const [selectedData, setSelectedData] = useState<string>("all");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  // New DataType Modal state
  const [isDataTypeModalOpen, setIsDataTypeModalOpen] = useState(false);
  const [selectedDataType, setSelectedDataType] = useState<number>(0);
  const [plansForDataType, setPlansForDataType] = useState<Plan[]>([]);
  const [activeConfig, setActiveConfig] = useState<PlanCardConfig | null>(null);

useEffect(() => {
  const slug = countryNameToSlug(country);

  setCountryCode(slugToCodeMap[slug]);
}, [country]);

useEffect(() => {
  async function load() {
    const c = resolvedParams.country;
    setCountry(c);
    setLoading(true); // Đảm bảo bật loading khi bắt đầu

    // Tạo một cái "hẹn giờ" 1.5 giây
    const minDelay = new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
      // Chạy song song: vừa lấy ảnh, vừa lấy plans, vừa đợi 1.5s
      const [imageUrl, data] = await Promise.all([
        fetchUnsplashImage(c),
        loadPlans(c),
        minDelay // Cái này sẽ giữ chân setLoading(false) ít nhất 1.5s
      ]);

      setHeroImage(imageUrl);
      setPlans(data);
      
    } catch (error) {
      console.error("Lỗi load data:", error);
    } finally {
      // Sau khi data xong VÀ đã đợi đủ 1.5s thì mới tắt loading
      setLoading(false);
    }
  }
  load();
}, [resolvedParams]);


  // Duration options
  const durationOptions = useMemo(() => {
    const plansToConsider = selectedData !== "all" 
      ? plans.filter(p => p.dataAmount === parseInt(selectedData))
      : plans;
    
    const durations = new Set<number>();
    plansToConsider.forEach(plan => {
      if (plan.durationDays) durations.add(plan.durationDays);
    });
    return Array.from(durations).sort((a, b) => a - b);
  }, [plans, selectedData]);

  

  // Data options
  const dataOptions = useMemo(() => {
    const plansToConsider = selectedDuration !== "all"
      ? plans.filter(p => p.durationDays === parseInt(selectedDuration))
      : plans;
    
    const dataAmounts = new Set<number>();
    plansToConsider.forEach(plan => {
      if (plan.dataAmount) dataAmounts.add(plan.dataAmount);
    });
    return Array.from(dataAmounts).sort((a, b) => a - b);
  }, [plans, selectedDuration]);

  // Combined filter
  const filteredPlans = useMemo(() => {
    return plans.filter(plan => {
      if (selectedDuration !== "all" && plan.durationDays !== parseInt(selectedDuration)) return false;
      if (selectedData !== "all" && plan.dataAmount !== parseInt(selectedData)) return true;
      return true;
    });
  }, [plans, selectedDuration, selectedData]);

  // Filter to only Fixed and Daily plans, then group by dataType only (for single country page)
  const displayPlans = useMemo(() => {
    // First filter only dataType 1 (Fixed) and 2 (Daily)
    const relevantPlans = filteredPlans.filter(p => p.dataType === 1 || p.dataType === 2);
    const groups: Record<string, GroupedPlan> = {};
    relevantPlans.forEach(plan => {
      // Group by dataType only: "fixed" or "daily"
      const dataTypeKey = plan.dataType === 1 ? "fixed" : "daily";
      const key = dataTypeKey; // Single key per dataType
      if (!groups[key]) {
        groups[key] = {
          key,
          destination: country.charAt(0).toUpperCase() + country.slice(1), // Use URL country param
          countryId: plan.countryId,
          fupPolicy: plan.fupPolicy,
          
          plans: [],
          minPrice: plan.retailPriceUsd || plan.priceUsd,
          maxPrice: plan.retailPriceUsd || plan.priceUsd,
          dataType: plan.dataType,
        };
      }
      groups[key].plans.push(plan);
      const price = plan.retailPriceUsd || plan.priceUsd;
      if (price < groups[key].minPrice) groups[key].minPrice = price;
      if (price > groups[key].maxPrice) groups[key].maxPrice = price;
    });
    // Return sorted: Fixed first (dataType=1), then Daily (dataType=2)
    return Object.values(groups).sort((a, b) => {
      if (a.dataType === 1 && b.dataType !== 1) return -1;
      if (b.dataType === 1 && a.dataType !== 1) return 1;
      return a.minPrice - b.minPrice;
    });
  }, [filteredPlans, country]);

  const displayNameId = plans.length > 0 ? plans[0].countryId || country : country;
  


  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const handleDataTypeClick = (dataType: number, groupPlans: Plan[], config?: PlanCardConfig) => {
    setSelectedDataType(dataType);
    setPlansForDataType(groupPlans);
    if (config) {
      setActiveConfig(config);
    }
    setIsDataTypeModalOpen(true);
  };

  const handleCloseDataTypeModal = () => {
    setIsDataTypeModalOpen(false);
    setSelectedDataType(0);
    setPlansForDataType([]);
  };



return (
  <div className="min-h-screen bg-white"> {/* Đổi sang nền trắng cho sạch */}
    {/* Header Section: Gọn gàng, khoe ảnh nhưng không chiếm chỗ */}
    <div className="relative w-full h-[45vh] lg:h-[40vh] overflow-hidden">
      <Image
        src={heroImage}
        alt={displayNameId}
        fill
        className="object-cover"
        priority
        unoptimized
      />
      {/* Gradient dốc từ trong suốt sang trắng để hòa tan vào phần nội dung bên dưới */}
      <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-black/30" />
      
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
        <p className="text-white/80 text-[10px] font-bold uppercase tracking-[0.4em] mb-3 drop-shadow-sm">
          {t("plans.premiumConnectivity")}
        </p>
         <h1 className="text-5xl md:text-7xl font-medium text-white mb-2 tracking-tighter drop-shadow-xl">
           {displayNameId && t(`countries.${displayNameId}`) !== `countries.${displayNameId}`
             ? t(`countries.${displayNameId}`)
             : displayNameId || "Select Destination"}
         </h1>
        <div className="h-1 w-12 bg-orange-500 rounded-full mb-4 shadow-lg shadow-orange-500/50" />
      </div>
    </div>

    {/* Content Section: Đẩy Grid lên sát hơn */}
    <div className="max-w-7xl mx-auto px-6 -mt-24 relative z-10 ">
      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 pb-12 ">
        {displayPlans.map((group, index) => (
          <FadeIn key={group.key}> 
            {/* Thêm wrapper để căn chỉnh card chuẩn hơn */}
            <div className="h-full flex flex-col">
              <PlansCard 
                group={group} 
                onDetailClick={(config) => handleDataTypeClick(group.dataType, group.plans, config)} 
              />
            </div>
          </FadeIn>
        ))}

       
      </div>
    </div>

    {/* Footer trang - Nếu cần thông tin thêm thì để ở đây nhẹ nhàng */}
    <div className="max-w-2xl mx-auto text-center pb-20 px-6">
      <p className="text-slate-400 text-sm leading-relaxed">
        {t("countryPage.esimPlansAvailableDesc")}
      </p>
    </div>

    {/* Modal */}
    <EsimDataTypeModal
      dataType={selectedDataType}
      countryName={country}
      countryId={countryCode!}
      isOpen={isDataTypeModalOpen}
      onClose={handleCloseDataTypeModal}
      config={activeConfig}
    />
  </div>
);
}

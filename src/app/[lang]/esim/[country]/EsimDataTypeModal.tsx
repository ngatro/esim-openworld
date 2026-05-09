"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { getDestinationImage } from "@/lib/unsplash";
import { useI18n } from "@/components/providers/I18nProvider";
import { PlanCardConfig } from "./PlansCard";

interface Plan {
  id: string;
  name: string;
  packageCode: string;
  destination: string;
  dataAmount: number;
  dataVolume: number;
  durationDays: number;
  priceUsd: number;
  retailPriceUsd: number;
  dataType: number;
  supportTopUp: boolean;
  supportTopUpType: number;
  countryCode: string | null;
  countryName: string | null;
  regionId: string | null;
  regionName: string | null;
  fupPolicy: string | null;
  topupPackageId?: number;
  speed?: string | null;
  networkType?: string | null;
  locationNetworkList?: string | null;
  ipExport?: string | null;
  coverageCount?: number;
  smsStatus?: number;
  activeType?: number;
  unusedValidTime?: number;
  badge?: string | null;
  isPopular?: boolean;
  isBestSeller?: boolean;
  isHot?: boolean;
  locations?: unknown;
}

interface TopupPackage {
  id: number;
  planId: string;
  packageCode: string;
  name: string | null;
  priceUsd: number;
  retailPriceUsd: number;
  isFlexible: boolean;
  isActive: boolean;
}

interface EsimDataTypeModalProps {
  // plans: Plan[];
  dataType: number;
  countryName: string;
  countryId: string;
  isOpen: boolean;
  onClose: () => void;
  config?: PlanCardConfig | null;
}

function formatData(gb: number, volume?: number): string {
  const dataValue = gb > 0 ? gb : (volume ? Math.round((volume / (1024 * 1024 * 1024)) * 10) / 10 : 0);
  if (dataValue >= 999) return "Unlimited";
  if (dataValue < 1 && dataValue > 0) return `${Math.round(dataValue * 1024)}MB`;
  if (dataValue === 0) return "N/A";
  return `${dataValue}GB`;
}

export default function EsimDataTypeModal({
  // plans,
  dataType,
  countryName,
  countryId,
  isOpen,
  onClose,
  config,
}: EsimDataTypeModalProps) {
  const { t, formatPrice, locale } = useI18n();
  const [imgError, setImgError] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [networkList, setNetworkList] = useState<any[]>([]);
  const [locationsList, setLocationsList] = useState<string[]>([]);
  
  
  // Initialize state from config, but allow user to change selection in modal
  const [selectedData, setSelectedData] = useState(config?.selectedData ?? 0);
  const [selectedDuration, setSelectedDuration] = useState(config?.selectedDuration ?? 0);
  const [dataCategory, setDataCategory] = useState<'regular' | 'fup'>(config?.dataCategory ?? 'regular');
  
  // Update state when config changes (when user clicks different PlansCard)
  useEffect(() => {
    if (config) {
      setSelectedData(config.selectedData ?? 0);
      setSelectedDuration(config.selectedDuration ?? 0);
      setDataCategory(config.dataCategory ?? 'regular');
    }
  }, [config]);
  
    // Use config values for computed data - wrap in useMemo to prevent stale closures
const topupPackages = useMemo(() => config?.topupPackages ?? [], [config?.topupPackages]);
    const fupPlans = useMemo(() => config?.fupPlans ?? [], [config?.fupPlans]);
    const regularPlans = useMemo(() => config?.regularPlans ?? [], [config?.regularPlans]);
    const dataOptions = useMemo(() => config?.dataOptions ?? [], [config?.dataOptions]);
    const fupDataOptions = useMemo(() => config?.fupDataOptions ?? [], [config?.fupDataOptions]);
    // For FUP, durations are static; for regular, recompute based on selectedData
    const fupDurationOptions = useMemo(() => config?.fupDurationOptions ?? [], [config?.fupDurationOptions]);
    const regularDurationOptions = useMemo(() => {
      if (!regularPlans.length) return [];
      return Array.from(new Set(regularPlans.filter(p => p.dataAmount === selectedData).map(p => p.durationDays))).sort((a, b) => a - b);
    }, [regularPlans, selectedData]);

    // Auto-update duration when data changes in regular mode
    useEffect(() => {
      if (dataCategory === 'regular' && regularDurationOptions.length > 0) {
        if (!regularDurationOptions.includes(selectedDuration)) {
          setSelectedDuration(regularDurationOptions[0]);
        }
      }
    }, [regularDurationOptions, selectedDuration, dataCategory]);

    const allDurations = [1, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 180];
  
  // Computed values that depend on selection
  const ALL_DURATIONS = [1, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 180];
  
  // Find base plan based on current selection
  const basePlan = useMemo(() => {
    const plansToSearch = dataCategory === 'fup' ? fupPlans : regularPlans;
    if (!plansToSearch.length) return null;
    
    const sameDataPlans = plansToSearch.filter(p => p.dataAmount === selectedData);
    if (sameDataPlans.length > 0) {
      const exactDuration = sameDataPlans.find(p => p.durationDays === selectedDuration);
      if (exactDuration) return exactDuration;
      
      const availableDurations = sameDataPlans.map(p => p.durationDays).sort((a, b) => a - b);
      const closestDuration = availableDurations.find(d => d <= selectedDuration) || availableDurations[0];
      return sameDataPlans.find(p => p.durationDays === closestDuration) || sameDataPlans[0];
    }
    return plansToSearch[0];
  }, [regularPlans, fupPlans, selectedData, selectedDuration, dataCategory]);

  // Find topup package
  const topupPackage = useMemo(() => {
    if (!basePlan) return null;
    if (basePlan.topupPackageId) {
      const linked = topupPackages.find(p => p.id === basePlan.topupPackageId);
      if (linked) return linked;
    }
    const forPlan = topupPackages.find(p => p.planId === basePlan.id);
    if (forPlan) return forPlan;
    const flexible = topupPackages.find(p => p.isFlexible);
    if (flexible) return flexible;
    return null;
  }, [topupPackages, basePlan]);
  
  // Calculate price
  const pricePreview = useMemo(() => {
    if (basePlan && topupPackage && selectedDuration > basePlan.durationDays) {
      const basePrice = basePlan.retailPriceUsd > 0 ? basePlan.retailPriceUsd : basePlan.priceUsd;
      const topupRetail = topupPackage.retailPriceUsd > 0 ? topupPackage.retailPriceUsd : topupPackage.priceUsd;
      const extraDays = selectedDuration - basePlan.durationDays;
      return basePrice + (extraDays * topupRetail);
    }
    if (basePlan) {
      return basePlan.retailPriceUsd > 0 ? basePlan.retailPriceUsd : basePlan.priceUsd;
    }
    return 0;
  }, [basePlan, topupPackage, selectedDuration]);
  
  // Find exact plan
  const exactPlan = useMemo(() => {
    const plansToSearch = dataCategory === 'fup' ? fupPlans : regularPlans;
    
    // First try exact match
    const exact = plansToSearch.find(p => p.dataAmount === selectedData && p.durationDays === selectedDuration);
    if (exact) return exact;
    
    // If not found, try to find any plan with same data amount
    const sameData = plansToSearch.find(p => p.dataAmount === selectedData);
    if (sameData) return sameData;
    
    // Fallback: return first plan in the category
    return plansToSearch[0];
  }, [regularPlans, fupPlans, selectedData, selectedDuration, dataCategory]);
  
  // Computed flags
  const canMultiply = useMemo(() => {
    return topupPackages.some(p => p.isFlexible);
  }, [topupPackages]);
  
  const supportTopUpType = useMemo(() => {
    const allPlans = [...regularPlans, ...fupPlans];
    const maxType = allPlans.reduce((max, p) => Math.max(max, p.supportTopUpType || 1), 1);
    return maxType;
  }, [regularPlans, fupPlans]);
  
  const isUsingTopUp = useMemo(() => {
    return !exactPlan && supportTopUpType === 3 && canMultiply && basePlan !== null && topupPackage !== null;
  }, [exactPlan, supportTopUpType, canMultiply, basePlan, topupPackage]);

  // Parse locationNetworkList and locations when basePlan changes
  useEffect(() => {
    let networkListParsed: any[] = [];
    let locationsParsed: string[] = [];
    try {
      if (basePlan?.locationNetworkList) {
        const networkData = typeof basePlan.locationNetworkList === 'string'
          ? JSON.parse(basePlan.locationNetworkList)
          : basePlan.locationNetworkList;
        networkListParsed = Array.isArray(networkData) ? networkData : [];
      }
      if (basePlan?.locations) {
        locationsParsed = Array.isArray(basePlan.locations)
          ? basePlan.locations
          : JSON.parse(basePlan.locations as string);
      }
    } catch {
      networkListParsed = [];
      locationsParsed = [];
    }
    setNetworkList(networkListParsed);
    setLocationsList(locationsParsed);
  }, [basePlan]);

  // Auto-adjust selectedDuration for regular plans when available durations change after data selection
  useEffect(() => {
    if (dataCategory === 'regular' && regularDurationOptions.length > 0) {
      const maxAvailable = Math.max(...regularDurationOptions);
      // If current selection is not in available options AND is <= max, reset to first option
      if (!regularDurationOptions.includes(selectedDuration) && selectedDuration <= maxAvailable) {
        setSelectedDuration(regularDurationOptions[0]);
      }
    }
  }, [dataCategory, regularDurationOptions, selectedDuration]);


  // All durations are enabled - topup allows any duration
  const isDurationDisabled = (_duration: number) => false;
  
  if (!isOpen) return null;
  
  const heroImage = imgError 
    ? "/favicon.ico" 
    : getDestinationImage(countryId?.toLowerCase() || countryName.toLowerCase());
    
  
    

return (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4 bg-slate-900/60 backdrop-blur-sm"
      >
        <motion.div className="absolute inset-0" onClick={onClose} />
         
        <motion.div
          initial={{ scale: 0.98, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.98, opacity: 0, y: 10 }}
          className="relative bg-white md:rounded-3xl shadow-2xl w-full max-w-7xl max-h-[95vh] md:max-h-[90vh] overflow-hidden flex flex-col lg:flex-row"
        >
          {/* Close Button */}
          <button onClick={onClose} className="absolute top-4 right-4 z-[70] p-2 bg-white/80 backdrop-blur-md rounded-full text-slate-400 hover:text-orange-500 transition-colors shadow-sm">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* CỘT TRÁI: Media & Specs (Cuộn độc lập) */}
          <div className="lg:w-[60%] xl:w-[65%] flex flex-col overflow-y-auto border-r border-slate-100 bg-white custom-scrollbar h-[35vh] lg:h-auto">
            <div className="relative w-full aspect-video lg:aspect-[16/8] shrink-0">
              <Image src={heroImage} alt={countryName} fill className="object-cover" unoptimized />
              <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 lg:bottom-8 lg:left-10">
                 <h2 className="text-4xl lg:text-6xl font-bold text-slate-900 tracking-tighter drop-shadow-sm">
                   {countryId && t(`countries.${countryId}`) !== `countries.${countryId}`
                     ? t(`countries.${countryId}`)
                     : countryId || countryName || "Unknown"}
                 </h2>
               </div>
            </div>

            <div className="px-6 lg:px-10 py-8 space-y-8">
              <div>
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-5">{t("esimDataTypeModal.planSpecs")}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <SpecBoxSimple label={t("esimDataTypeModal.network")} value={exactPlan?.networkType || "4G/5G"} />
                  <SpecBoxSimple label={t("esimDataTypeModal.speed")} value={exactPlan?.speed || "Max Speed"} />
                  <SpecBoxSimple label={t("esimDataTypeModal.activation")} value={exactPlan?.activeType === 1 ? t("esimDataTypeModal.instant") : t("esimDataTypeModal.manual")} />
                  <SpecBoxSimple label={t("esimDataTypeModal.topUp")} value={exactPlan?.supportTopUp ? t("esimDataTypeModal.available") : t("esimDataTypeModal.no")} />
                </div>
              </div>

               {/* Coverage - show for multi-country plans */}
               {(basePlan?.coverageCount || 0) >= 2 && networkList.length > 0 && (
                 <div>
                   <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">{t("esimDataTypeModal.planSpecs")} - {networkList.length} {t("plans.countries")}</h3>
                   <div className="flex flex-wrap gap-2">
                     {networkList.map((loc: any, idx: number) => (
                       <div key={idx} className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                         <p className="text-xs font-medium text-slate-700">
                           {loc.locationName && loc.locationCode && t(`countries.${loc.locationCode}`) !== `countries.${loc.locationCode}`
                             ? t(`countries.${loc.locationCode}`)
                             : loc.locationName || loc.locationCode || "Unknown"}
                         </p>
                       </div>
                     ))}
                   </div>
                 </div>
               )}

              {/* Coverage - show for single country plans with multiple operators */}
              {(basePlan?.coverageCount || 0) === 1 && networkList.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-5">{t("plans.networkOperators")}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {networkList[0]?.operatorList?.map((op: any, idx: number) => (
                      <span
                        key={idx}
                        className="bg-slate-50 px-3 py-1.5 rounded-lg text-xs text-slate-600 border border-slate-100 font-medium"
                      >
                        {op.operatorName} {op.networkType}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-4 bg-orange-500 rounded-full" />
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Fair Usage Policy (FUP)</h4>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {exactPlan?.fupPolicy ? (
                    <>
                      {t("esimDataTypeModal.afterUsing")}{' '}
                      <span className="font-bold text-orange-500">
                        {selectedData}GB
                      </span>{" "}
                      {t("esimDataTypeModal.limitTo")}{" "}
                      <span className="font-bold text-orange-500">
                        {exactPlan.fupPolicy}
                      </span>
                      . {t("esimDataTypeModal.restore")}
                    </>
                  ) : (
                    `${t("esimDataTypeModal.fupDesc")}`
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: Selections & Checkout (Layout Flex để giữ chân Footer) */}
                   

          {/* CỘT PHẢI: Selections & Checkout (Layout Flex để giữ chân Footer) */}
          <div className="lg:w-[40%] xl:w-[35%] flex flex-col h-[65vh] lg:h-auto bg-white overflow-hidden">
            {/* Vùng cuộn lựa chọn */}
            <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-8 custom-scrollbar">
              {/* 1. Data Selection */}
              <div>
                <label className="text-[11px] font-bold text-slate-900 uppercase mb-4 block tracking-wider">{t("esimDataTypeModal.step1")}</label>
                <div className="grid grid-cols-3 gap-2">
                  {(dataCategory === 'fup' ? fupDataOptions : dataOptions).map((data) => (
                    <button
                      key={data}
                      onClick={() => setSelectedData(data)}
                      className={`py-3 rounded-xl text-sm font-semibold transition-all border-2 ${
                        selectedData === data
                          ? "border-orange-500 text-orange-600 bg-orange-50/30 shadow-sm"
                          : "border-slate-100 text-slate-500 hover:border-slate-200"
                      }`}
                    >
                      {dataType === 1 ? formatData(data) : `${formatData(data)}/${t("esimDataTypeModal.day")}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Duration Selection */}
              <div>
                <label className="text-[11px] font-bold text-slate-900 uppercase mb-4 block tracking-wider">{t("esimDataTypeModal.step2")}</label>
                {dataCategory === 'fup' ? (
                  <div className="grid grid-cols-3 gap-2">
                    {/* 1. Luôn hiện đủ các nút mặc định để khách có thể chọn lại tùy ý */}
                    {[1, 3, 5, 10, 15, 30].map((d) => (
                      <button
                        key={d}
                        onClick={() => setSelectedDuration(d)}
                        className={`py-3 rounded-xl text-sm font-semibold transition-all border-2 ${
                          // highlight màu cam nếu d trùng với selectedDuration truyền từ planCard vào
                          selectedDuration === d
                            ? "border-orange-500 text-orange-600 bg-orange-50/30"
                            : "border-slate-100 text-slate-500 hover:border-slate-200"
                        }`}
                      >
                        {d}d
                      </button>
                    ))}
                    <div className="relative col-span-3 mt-1">
                      <input
                        type="number"
                        placeholder="Custom days..."
                        value={[1, 3, 5, 10, 15, 30].includes(selectedDuration) ? "" : selectedDuration}
          
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (val > 0) setSelectedDuration(val);
                          else if (e.target.value === "") setSelectedDuration(1);
                        }}
                        className="w-full py-3.5 px-5 rounded-xl text-sm font-medium border-2 border-slate-100 focus:border-orange-500 outline-none transition-all bg-slate-50/50"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300">{t("esimDataTypeModal.day")}</span>
                    </div>
                  </div>
                 ) : (
                   <div className="grid grid-cols-3 gap-2">
                     {regularDurationOptions.map((d) => (
                       <button
                         key={d}
                         onClick={() => setSelectedDuration(d)}
                         className={`py-3 rounded-xl text-sm font-semibold transition-all border-2 ${
                           selectedDuration === d ? "border-orange-500 text-orange-600 bg-orange-50/30" : "border-slate-100 text-slate-500 hover:border-slate-200"
                         }`}
                       >
                         {d}d
                       </button>
                     ))}
                   </div>
                 )}
              </div>

              {/* Quantity */}
              <div className="flex items-center justify-between pt-2 pb-4">
                <span className="text-sm font-bold text-slate-700">{t("esimDataTypeModal.qty")}</span>
                <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-100">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-white rounded-lg transition-all">—</button>
                  <span className="w-10 text-center font-bold text-slate-800">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-white rounded-lg transition-all">+</button>
                </div>
              </div>
            </div>

            {/* Footer dính đáy: Giá & Action */}
            <div className="shrink-0 p-6 lg:p-8 bg-white border-t border-slate-100 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
              <div className="flex justify-between items-center mb-5">
                <div className="leading-tight">
                  <p className="text-2xl font-bold text-slate-900">{formatPrice(pricePreview * quantity)}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{t("esimDataTypeModal.total")} {selectedDuration} {t("esimDataTypeModal.day")}</p>
                </div>
                <button className="px-5 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 text-xs hover:bg-slate-50 transition-all active:scale-95">
                  {t("esimDataTypeModal.addToCart")}
                </button>
              </div>

              {exactPlan ? (
                <Link 
                  href={`/${locale}/checkout?planId=${exactPlan.id}&qty=${quantity}${
                  // Nếu số ngày chọn khác số ngày gốc của plan, hoặc đang ở chế độ Topup
                  (selectedDuration !== exactPlan.durationDays || isUsingTopUp) 
                    ? `&mode=topup&days=${selectedDuration}${topupPackage ? `&topupId=${topupPackage.id}` : ''}` 
                    : ''
                }`}
                  className="w-full py-4 rounded-2xl bg-orange-500 text-white font-bold text-base text-center block hover:bg-orange-600 transition-all shadow-lg shadow-orange-100 active:scale-[0.98]"
                >
                  {t("esimDataTypeModal.buyNow")}
                </Link>
              ) : (
                <button disabled className="w-full py-4 rounded-2xl bg-slate-100 text-slate-400 font-bold cursor-not-allowed">{t("esimDataTypeModal.planUnavailable")}</button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

function SpecBoxSimple({ label, value }: { label: string, value: string }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-orange-100 transition-colors">
      <p className="text-[10px] text-slate-400 font-bold uppercase mb-1.5 tracking-wider">{label}</p>
      <p className="text-sm font-bold text-slate-800 truncate">{value}</p>
    </div>
  );
}
}

"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Fuse from 'fuse.js'; // Thư viện tìm kiếm cực đỉnh
import countryDataRaw from '@/data/country-to-region.json';
import { useI18n } from "@/components/providers/I18nProvider";

interface CountryInfo {
  regionId: string;
  regionName: string;
  countryName: string;
}

interface CountryItem extends CountryInfo {
  code: string;
}

const COUNTRY_DATA = countryDataRaw as Record<string, CountryInfo>;

export default function SmartSearchBox() {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<CountryItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 1. Chuyển đổi dữ liệu: Đưa Key vào trong Object
  const countriesArray = useMemo(() => {
    return Object.entries(COUNTRY_DATA).map(([code, info]) => ({
      code: code, // BẮT BUỘC: Đưa "US", "UK" vào đây để Fuse nhìn thấy
    countryName: info.countryName,
    regionName: info.regionName,
    regionId: info.regionId
  }));
}, []);

// 2. Cấu hình Fuse: Chỉ định Fuse tìm trong trường 'code'
const fuse = useMemo(() => {
  return new Fuse(countriesArray, {
    keys: [
      { name: 'code', weight: 3 },        // Ưu tiên cực cao cho mã quốc gia (US, UK, VN)
      { name: 'countryName', weight: 2 }, // Tên quốc gia quan trọng nhì
      { name: 'regionName', weight: 1 }   // Vùng miền quan trọng ba
    ],
    threshold: 0.1, // Rất khắt khe để tránh ra kết quả linh tinh
    location: 0,
    distance: 100,
    includeMatches: true
  });
}, [countriesArray]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (value.trim().length > 0) {
      // 3. Tìm kiếm bằng Fuse thay vì .filter() "ngu"
      const results = fuse.search(value);
      const filtered = results.map(r => r.item).slice(0, 6);

      setSuggestions(filtered);
      setShowDropdown(true);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }
  };

  const handleSelect = (country: CountryItem) => {
  setQuery(country.countryName);
  setShowDropdown(false);

  // Chuyển "United States" thành "united-states", "Vietnam" thành "vietnam"
  // Dùng regex để thay khoảng trắng bằng dấu gạch ngang
  const slugName = country.countryName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-'); // Thay tất cả khoảng trắng bằng -

  // Luôn đẩy sang link tên đầy đủ cho đồng nhất
  router.push(`/${locale}/esim/${slugName}`);
};
  return (
    <div className="w-full max-w-2xl relative font-sans" ref={wrapperRef}>
      <div className="relative bg-white/70 backdrop-blur-xl rounded-[2rem] shadow-2xl transition-all duration-300 focus-within:ring-4 focus-within:ring-blue-500/10 border border-white/20">
        <input
          type="text"
          value={query}
          placeholder={(t as any)?.("common.searchPlaceholder") || "Thử gõ 'vn' hoặc 'thai'..."}
          className="w-full px-8 py-5 bg-transparent text-slate-800 placeholder:text-slate-400 focus:outline-none text-lg rounded-[2rem]"
          onChange={handleInputChange}
          onFocus={() => query && setShowDropdown(true)}
        />
        <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-3 bg-white/90 backdrop-blur-2xl rounded-[1.5rem] shadow-2xl overflow-hidden z-50 border border-slate-100">
          <div className="py-2">
            {suggestions.map((item) => (
              <button
                key={item.code}
                onClick={() => handleSelect(item)}
                className="w-full px-8 py-4 hover:bg-blue-50/80 flex items-center justify-between text-left group"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-700 group-hover:text-blue-600">
                    {item.countryName}
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest">
                    {item.regionName}
                  </span>
                </div>
                <span className="text-slate-300 group-hover:text-blue-400 font-mono text-sm">{item.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
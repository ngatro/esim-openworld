"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCart } from "@/components/providers/CartProvider";
import { useUI } from "@/components/providers/UIProvider";
import { useI18n, SUPPORTED_LOCALES } from "@/components/providers/I18nProvider";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";

const DEFAULT_HOT_COUNTRIES = [
  { code: "JP", name: "Japan", emoji: "🇯🇵" },
  { code: "KR", name: "Korea", emoji: "🇰🇷" },
  { code: "TH", name: "Thailand", emoji: "🇹🇭" },
  { code: "SG", name: "Singapore", emoji: "🇸🇬" },
  { code: "VN", name: "Vietnam", emoji: "🇻🇳" },
  { code: "US", name: "USA", emoji: "🇺🇸" },
  { code: "GB", name: "UK", emoji: "🇬🇧" },
  { code: "FR", name: "France", emoji: "🇫🇷" },
  { code: "DE", name: "Germany", emoji: "🇩🇪" },
];

const DEFAULT_REGIONS = [
  { id: "asia", name: "Asia", emoji: "🌏" },
  { id: "europe", name: "Europe", emoji: "🏰" },
  { id: "americas", name: "Americas", emoji: "🌎" },
  { id: "oceania", name: "Oceania", emoji: "🌴" },
  { id: "global", name: "Global", emoji: "🌐" },
];

export default function Header() {
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, loading: authLoading } = useAuth();
  const { items } = useCart();
  const { openLogin, openCart } = useUI();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [cartDropdownOpen, setCartDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [hotCountries, setHotCountries] = useState(DEFAULT_HOT_COUNTRIES);
  const [regions, setRegions] = useState(DEFAULT_REGIONS);
  const dropdownTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    setMounted(true);
    fetch("/api/config/nav")
      .then(res => res.json())
      .then(data => {
        if (data.hotCountries?.length) setHotCountries(data.hotCountries);
        if (data.regions?.length) setRegions(data.regions);
      })
      .catch(() => {});
  }, []);

  const handleMouseEnter = (dropdown: string) => {
    if (dropdownTimeoutRef.current[dropdown]) {
      clearTimeout(dropdownTimeoutRef.current[dropdown]);
    }
    if (dropdown === "cart") setCartDropdownOpen(true);
    if (dropdown === "user") setUserDropdownOpen(true);
    if (dropdown === "lang") setLangDropdownOpen(true);
  };

  const handleMouseLeave = (dropdown: string) => {
    dropdownTimeoutRef.current[dropdown] = setTimeout(() => {
      if (dropdown === "cart") setCartDropdownOpen(false);
      if (dropdown === "user") setUserDropdownOpen(false);
      if (dropdown === "lang") setLangDropdownOpen(false);
    }, 300);
  };

   const handleLanguageChange = (newLocale: string) => {
      setLocale(newLocale as typeof locale);
      
      // Get current pathname and remove any existing language prefix
      const currentPathname = pathname;
      const pathMatch = currentPathname.match(/^\/[a-z]{2}(.*)$/);
      const basePath = pathMatch ? pathMatch[1] : currentPathname;
      
      // Construct new URL with the selected language prefix
      const newPath = `/${newLocale}${basePath}`;
      
      // Navigate to the new URL
      router.push(newPath);
    };

  const currentLocaleLabel = SUPPORTED_LOCALES.find(l => l.code === locale)?.code.toUpperCase() || "EN";

  const cartCount = mounted ? items.reduce((sum, item) => sum + item.quantity, 0) : 0;

   const navItems: { label: string; href: string; children?: { label: string; href: string; emoji?: string; children?: { label: string; href: string; emoji?: string }[] }[] | null }[] = [
     { 
       label: t("common.home"), 
       href: `/${locale}`,
       children: null 
     },
     { 
       label: t("common.plans"), 
       href: `/${locale}/plans`,
       children: [
         { label: t("header.allPlans"), href: `/${locale}/plans` },
         { label: "divider", href: "" },
         { label: t("header.popularRegions"), href: "", children: regions.map((r: { id: string; name: string; emoji: string }) => ({ label: r.name, href: `/${locale}/plans?regionId=${r.id}`, emoji: r.emoji })) },
         { label: t("header.hotCountries"), href: "", children: hotCountries.map((c: { code: string; name: string; emoji: string }) => ({ label: c.name, href: `/${locale}/plans?countryId=${c.code}`, emoji: c.emoji })) },
       ]
     },
     { 
       label: t("header.devices"), 
       href: `/${locale}/compatibility`,
       children: null
     },
     { 
       label: t("common.blog"), 
       href: `/${locale}/blog`,
       children: null 
     },
     { 
       label: t("common.orders"), 
       href: `/${locale}/orders`,
       children: null 
     },
     { 
       label: t("header.support"), 
       href: `/${locale}/support`,
       children: null 
     },
   ];

const userItems = mounted && user ? [
    //  { label: t("header.myOrders"), href: `/${locale}/orders`, children: null },
     { label: t("common.affiliate"), href: `/${locale}/affiliate`, nchildren: null },
     { label: t("common.wallet"), href: `/${locale}/wallet`, children: null },
     ...(user.role === "admin" ? [{ label: t("common.admin"), href: `/${locale}/admin`, children: null }] : []),
   ] : [];

  const allItems = [...navItems, ...userItems];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side: Mobile Menu Toggle + Logo */}
          <div className="flex items-center gap-2">
            {/* Mobile Menu Toggle - visible only on mobile */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:text-orange-500 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            {/* Logo */}
            <Link href={`/${locale}`} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center">
                <Image
                  src="/logo.png"
                  alt="eSIM Logo"
                  width={45}
                  height={45}
                  priority
                  className=" w-full h-auto text-white object-contain"
                />
              </div>
              <span className="text-lg font-semibold text-slate-800">
                Open<span className="text-orange-500">World</span>
              </span>
            </Link>
          </div>

          {/* Desktop Nav with Dropdown */}
          <nav className="hidden md:flex items-center gap-1">
            {allItems.map((item) => (
              <div 
                key={item.href} 
                className="relative"
                onMouseEnter={() => item.children && setActiveDropdown(item.href)}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                {item.children ? (
                  <button className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-600 hover:text-orange-500 transition-colors ">
                    {item.label}
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                ) : (
                  <Link 
                    href={item.href} 
                    className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-orange-500 transition-colors relative group"
                  >
                    {item.label}
                    {/* Thanh gạch chân giả nằm ở đây */}
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-orange-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                  </Link>
                )}

                {/* Dropdown */}
                <AnimatePresence>
                  {item.children && activeDropdown === item.href && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className={`absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-50 ${
                        item.href.endsWith("/plans") ? "w-[480px]" : "w-56"
                      }`}
                    >
                      {item.href.endsWith("/plans") ? (
                        <>
                          <div className="px-4 pt-3">
                            <Link
                              href={`/${locale}/plans`}
                              className="flex items-center justify-center gap-2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors mb-3"
                            >
                              <span>🌐</span> {t("header.allPlans")}
                            </Link>
                          </div>

                          <div className="grid grid-cols-2 gap-4 px-4 pb-3">
                            <div>
                              <p className="text-xs font-semibold text-slate-400 uppercase mb-2">
                                {t("header.popularRegions")}
                              </p>
                              <div className="space-y-0.5">
                                {regions.map((r: any, idx: number) => (
                                  <Link
                                    key={idx}
                                    href={`/${locale}/plans?regionId=${r.id}`}
                                    className="flex items-center gap-2 py-1 text-sm text-slate-600 hover:text-orange-500 transition-all w-fit bg-gradient-to-r from-orange-500 to-orange-500 bg-[length:0%_2px] bg-left-bottom bg-no-repeat hover:bg-[length:100%_2px] duration-300"
                                  >
                                    {r.emoji && <span>{r.emoji}</span>}
                                    {/* {r.name.toLowerCase()} */}
                                    <span>{t(`regions.${r.name.toLowerCase()}`)}</span>
                                  </Link>
                                ))}
                              </div>
                            </div>

                            <div>
                              <p className="text-xs font-semibold text-slate-400 uppercase mb-2">
                                {t("header.hotCountries")}
                              </p>
                              <div className="space-y-0.5">
                                {hotCountries.map((c: any, idx: number) => (
                                  <Link
                                    key={idx}
                                    href={`/${locale}/plans?countryId=${c.code}`}
                                    className="flex items-center gap-2 py-1 text-sm text-slate-600 hover:text-orange-500 transition-all w-fit bg-gradient-to-r from-orange-500 to-orange-500 bg-[length:0%_2px] bg-left-bottom bg-no-repeat hover:bg-[length:100%_2px] duration-300"
                                  >
                                    {c.emoji && <span>{c.emoji}</span>}
                                    <span>{t(`countries.${c.code}`)}</span>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        item.children.map((child: any, idx: number) => (
                          child.label === "divider" ? (
                            <div key={idx} className="my-1 border-t border-slate-100" />
                          ) : child.children ? (
                            <div key={idx} className="px-4 py-1">
                              <p className="text-xs font-semibold text-slate-400 uppercase mb-1">
                                {child.label}
                              </p>
                              <div className="space-y-0.5">
                                {child.children.map((sub: any, subIdx: number) => (
                                  <Link
                                    key={subIdx}
                                    href={sub.href}
                                    className="flex items-center gap-2 py-1 text-sm text-slate-600 hover:text-orange-500 transition-all w-fit bg-gradient-to-r from-orange-500 to-orange-500 bg-[length:0%_2px] bg-left-bottom bg-no-repeat hover:bg-[length:100%_2px] duration-300"
                                  >
                                    {sub.emoji && <span>{sub.emoji}</span>}
                                    {sub.label}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div key={idx} className="px-4">
                              <Link
                                href={child.href}
                                className="flex items-center py-2 text-sm text-slate-600 hover:text-orange-500 transition-all w-fit bg-gradient-to-r from-orange-500 to-orange-500 bg-[length:0%_2px] bg-left-bottom bg-no-repeat hover:bg-[length:100%_2px] duration-300"
                              >
                                {child.label}
                              </Link>
                            </div>
                          )
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </nav>

          {/* Right Side */}
          <div className="flex items-center gap-2">
            {/* Language Selector - Desktop only */}
            <div
              className="relative hidden md:block"
              onMouseEnter={() => handleMouseEnter("lang")}
              onMouseLeave={() => handleMouseLeave("lang")}
            >
              <button className="flex items-center gap-1 px-2 py-1.5 text-sm text-slate-600 hover:text-orange-500 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                <span className="text-xs">{currentLocaleLabel}</span>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <AnimatePresence>
                {langDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 min-w-[140px]"
                  >
                    {SUPPORTED_LOCALES.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => handleLanguageChange(l.code)}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-orange-50 hover:text-orange-500 flex items-center gap-2 ${locale === l.code ? "text-orange-500 bg-orange-50" : "text-slate-600"}`}
                      >
                        <span>{l.flag}</span>
                        <span>{l.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Cart */}
            <div 
              className="relative"
              onMouseEnter={() => handleMouseEnter("cart")}
              onMouseLeave={() => handleMouseLeave("cart")}
            >
              <button className="relative p-2 text-slate-600 hover:text-orange-500 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>
              <AnimatePresence>
                {cartDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute right-0 top-full mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50"
                  >
                    {cartCount === 0 ? (
                      <div className="p-4 text-center text-slate-500 text-sm">Your cart is empty</div>
                    ) : (
                      <div className="p-2">
                        <div className="max-h-60 overflow-y-auto">
                          {items.slice(0, 3).map((item) => (
                            <div key={item.planId} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg">
                              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-lg">
                                {item.planName?.[0] || "📱"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{item.planName}</p>
                                <p className="text-xs text-slate-500">${item.price.toFixed(2)} x {item.quantity}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        {cartCount > 3 && (
                          <p className="text-xs text-slate-500 text-center py-1">+{cartCount - 3} more items</p>
                        )}
                        <button 
                          onClick={openCart}
                          className="w-full mt-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium py-2 rounded-lg"
                        >
                          View Cart ({cartCount})
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Auth - User Dropdown */}
            {mounted && authLoading ? (
              <div className="hidden md:flex items-center gap-2">
                <div className="w-8 h-8 bg-slate-100 rounded-lg animate-pulse" />
              </div>
            ) : mounted && !authLoading && user ? (
              <div
                className="relative"
                onMouseEnter={() => handleMouseEnter("user")}
                onMouseLeave={() => handleMouseLeave("user")}
              >
                <button className="flex items-center gap-2 px-3 py-1.5 text-slate-600 hover:text-orange-500 transition-colors">
                  <span className="text-sm font-medium">
                    {t("header.welcome")}, {user.name?.split(' ')[0] || user.name}
                  </span>
                </button>
                <AnimatePresence>
                  {userDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50"
                    >
                      <div className="px-4 py-2 border-b border-slate-100">
                        <p className="text-sm font-medium text-slate-800 truncate">{user.name}</p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      </div>
                          <Link href={`/${locale}/profile`} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-orange-50 hover:text-orange-500">
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                             <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                           </svg>
                           {t("common.profile") || "Profile"}
                         </Link>
                         <Link href={`/${locale}/orders`} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-orange-50 hover:text-orange-500">
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                             <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                           </svg>
                           {t("header.myOrders")}
                         </Link>
                         <Link href={`/${locale}/affiliate`} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-orange-50 hover:text-orange-500">
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                             <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                           </svg>
                            {t("common.affiliate")}
                         </Link>
                         <Link href={`/${locale}/wallet`} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-orange-50 hover:text-orange-500">
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                             <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                           </svg>
                           {t("common.wallet")}
                         </Link>
                      <div className="border-t border-slate-100 mt-1 pt-1">
                        <button
                          onClick={() => logout()}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:bg-orange-50 hover:text-orange-500"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          {t("header.logout")}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : mounted && !authLoading && !user ? (
              <button 
                onClick={openLogin}
                className="hidden md:flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {t("header.login")}
              </button>
            ) : null}

            {/* Mobile Login Button (visible on mobile only) */}
            {mounted && !authLoading && !user && (
              <button
                onClick={openLogin}
                className="md:hidden flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {t("header.login")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="md:hidden bg-white border-t border-slate-100"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="px-4 py-4 space-y-2">
              {/* Language Selector - Mobile only (dropdown like desktop) */}
              <details className="group border-b border-slate-100 pb-2 mb-1">
                <summary className="flex items-center justify-between py-2 text-slate-600 font-medium cursor-pointer list-none">
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    {t("header.language")}
                  </span>
                  <svg className="w-4 h-4 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="pl-4 space-y-1 mt-1">
                  {SUPPORTED_LOCALES.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => {
                        handleLanguageChange(l.code);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 py-1.5 text-sm ${
                        locale === l.code
                          ? "text-orange-500 font-medium"
                          : "text-slate-500 hover:text-orange-500"
                      }`}
                    >
                      <span>{l.flag}</span> <span>{l.label}</span>
                    </button>
                  ))}
                </div>
              </details>

              {navItems.map((item) => (
                <div key={item.href}>
                  {item.children ? (
                    <details className="group">
                      <summary className="flex items-center justify-between py-2.5 text-slate-600 font-medium cursor-pointer list-none">
                        <span>{item.label}</span>
                        <svg className="w-4 h-4 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="pl-4 space-y-1 mt-1">
                        {item.children.filter((c: { label: string }) => c.label !== "divider").map((child: { label: string; href: string; children?: { label: string; href: string; emoji?: string }[] }, idx: number) => (
                          <div key={idx}>
                            {child.children ? (
                               <div className="py-1">
                                 <p className="text-xs font-semibold text-slate-400 uppercase mb-1">{child.label}</p>
                                 <div className="space-y-0.5">
                                   {child.children.map((sub: { label: string; href: string; emoji?: string }, subIdx: number) => (
                                     <Link
                                       key={subIdx}
                                       href={sub.href}
                                       onClick={() => setMobileMenuOpen(false)}
                                       className="flex items-center gap-2 py-1.5 text-sm text-slate-600 hover:text-orange-500 transition-colors"
                                     >
                                       {sub.emoji && <span>{sub.emoji}</span>}
                                       {sub.label}
                                     </Link>
                                   ))}
                                 </div>
                               </div>
                             ) : (
                                <Link
                                  key={idx}
                                  href={child.href}
                                  onClick={() => setMobileMenuOpen(false)}
                                  className="block py-1.5 text-sm text-slate-500"
                                >
                                 {child.label}
                               </Link>
                             )}
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : (
                    <Link
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block py-2.5 text-slate-600 font-medium"
                    >
                      {item.label}
                    </Link>
                  )}
                </div>
              ))}

              {/* Admin Section - Only visible to admin role */}
              {mounted && !authLoading && user?.role === 'admin' && (
                <div className="pt-2 mt-2 border-t border-slate-100">
                  <p className="px-0 text-xs font-semibold text-orange-500 uppercase mb-2">
                    Management
                  </p>
                  <Link
                    href={`/${locale}/admin`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 py-2.5 text-slate-700 font-bold hover:text-orange-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Admin Dashboard
                  </Link>
                </div>
              )}

              {mounted && !authLoading && user && (
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                className="w-full mt-2 py-2.5 px-4 text-center text-orange-500 font-semibold border border-orange-500 rounded-lg hover:bg-orange-500 hover:text-white transition-all duration-200"                >
                  {t("header.logout")}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { CODE_TO_COUNTRY } from '@/lib/countries';

// 1. Map Quốc gia sang Ngôn ngữ (Dựa trên IP từ Cloudflare)
const COUNTRY_TO_LANG: Record<string, string> = {
  VN: 'vi',
  DE: 'de', AT: 'de', CH: 'de',
  FR: 'fr', BE: 'fr', LU: 'fr',
  // Mặc định các nước còn lại sẽ là 'en'
};

// const CODE_TO_COUNTRY: Record<string, string> = {
//   TH: 'thailand', VN: 'vietnam', JP: 'japan', KR: 'south-korea', CN: 'china',
//   US: 'united-states', AU: 'australia', SG: 'singapore', MY: 'malaysia', ID: 'indonesia',
//   PH: 'philippines', HK: 'hong-kong', TW: 'taiwan', IN: 'india', AE: 'uae',
//   GB: 'united-kingdom', FR: 'france', DE: 'germany', IT: 'italy', ES: 'spain', NL: 'netherlands',
//   CA: 'canada', MX: 'mexico', BR: 'brazil',
// };

const COUNTRY_LOOKUP = Object.fromEntries(
  Object.entries(CODE_TO_COUNTRY).flatMap(([k, v]) => [
    [k.toUpperCase(), v],
    [k.toLowerCase(), v]
  ])
);

const REGION_MAP: Record<string, string> = {
  global: 'global', asia: 'asia', europe: 'europe', americas: 'americas', oceania: 'oceania',
};

const COOKIE_CONFIG = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 2592000, // 30 days
  path: '/',
};

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const refCode = searchParams.get('ref');
  const hasRefCookie = request.cookies.has('simpal_ref');

  // --- LOGIC TỰ ĐỘNG CHỌN NGÔN NGỮ ---
  
  // Lấy mã quốc gia từ Cloudflare (ví dụ: 'VN', 'DE', 'US')
  const cfCountry = request.headers.get('cf-ipcountry') || 'US';
  
  // Xác định ngôn ngữ đích dựa trên IP
  const detectedLang = COUNTRY_TO_LANG[cfCountry] || 'en';
  
  // CHẶN LỖI LOOP API
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname.includes('.')) {
    return NextResponse.next();
  }
  
  // Nếu truy cập root (/)
  if (pathname === '/') {
    // Redirect thẳng đến ngôn ngữ đã nhận diện qua IP
    const response = NextResponse.redirect(new URL(`/${detectedLang}`, request.url), 301);
    if (refCode && !hasRefCookie) {
      response.cookies.set('simpal_ref', refCode, COOKIE_CONFIG);
    }
    return response;
  }

  // --- HẾT LOGIC TỰ ĐỘNG CHỌN NGÔN NGỮ ---

  const pathMatch = pathname.match(/^\/([a-z]{2})(.*)$/);
  let langPrefix = '';
  let restOfPath = pathname;
  
  if (pathMatch) {
    const [, lang, rest] = pathMatch;
    if (['en', 'de', 'fr', 'vi'].includes(lang)) {
      langPrefix = `/${lang}`;
      restOfPath = rest;
    }
  } else {
    // Nếu pathname KHÔNG có lang prefix (ví dụ: /esim/vietnam)
    // Tự động chèn lang dựa trên IP vào trước path
    const response = NextResponse.redirect(new URL(`/${detectedLang}${pathname}`, request.url), 301);
    return response;
  }

  // --- CÁC SEO REDIRECTS CŨ CỦA BẠN ---
  
  if (restOfPath.startsWith('/plans/')) {
    const slugParam = restOfPath.split('/')[2];
    if (slugParam && !/^\d+$/.test(slugParam)) {
      const countryMatch = slugParam.match(/^esim-([a-z]+)-/);
      const country = countryMatch ? countryMatch[1] : slugParam.split('-')[0];
      const response = NextResponse.redirect(new URL(`${langPrefix}/esim/${country}/${slugParam}`, request.url), 301);
      if (refCode && !hasRefCookie) {
        response.cookies.set('simpal_ref', refCode, COOKIE_CONFIG);
      }
      return response;
    }
  }

  if (restOfPath.startsWith('/esim/')) {
    const segments = restOfPath.split('/');
    if (segments.length === 3) {
      const code = segments[2];
      if (code.length === 2 && COUNTRY_LOOKUP[code]) {
        const response = NextResponse.redirect(new URL(`${langPrefix}/esim/${COUNTRY_LOOKUP[code]}`, request.url), 301);
        if (refCode && !hasRefCookie) {
          response.cookies.set('simpal_ref', refCode, COOKIE_CONFIG);
        }
        return response;
      }
    }
  }

  if (restOfPath === '/plans') {
    const countryId = searchParams.get('countryId');
    if (countryId) {
      const slug = COUNTRY_LOOKUP[countryId] || countryId.toLowerCase();
      const response = NextResponse.redirect(new URL(`${langPrefix}/esim/${slug}`, request.url), 301);
      if (refCode && !hasRefCookie) {
        response.cookies.set('simpal_ref', refCode, COOKIE_CONFIG);
      }
      return response;
    }

    const regionId = searchParams.get('regionId');
    if (regionId) {
      const slug = REGION_MAP[regionId] || regionId.toLowerCase();
      const response = NextResponse.redirect(new URL(`${langPrefix}/esim/${slug}`, request.url), 301);
      if (refCode && !hasRefCookie) {
        response.cookies.set('simpal_ref', refCode, COOKIE_CONFIG);
      }
      return response;
    }
  }

  if (refCode && !hasRefCookie) {
    const response = NextResponse.next();
    response.cookies.set('simpal_ref', refCode, COOKIE_CONFIG);
    return response;
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|assets|favicon.ico|sw.js).*)',
  ],
};
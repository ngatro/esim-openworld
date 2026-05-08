import { Metadata } from "next";
import EsimCountryClient from "./EsimCountryClient";
import fs from "fs";
import path from "path";

type Props = {
  params: Promise<{ country: string; lang: string }>; // Lưu ý: Nếu URL của bạn là [lang]
};

// Hàm đọc file JSON thủ công ở Server
async function getTranslationServer(locale: string, key: string, variables: Record<string, string>) {
  try {
    // Tìm đường dẫn đến thư mục messages
    const filePath = path.join(process.cwd(), "src/messages", `${locale}.json`);
    const fileContent = fs.readFileSync(filePath, "utf8");
    const messages = JSON.parse(fileContent);

    // Lấy giá trị từ key (ví dụ: "metadata.title")
    const keys = key.split(".");
    let value = messages;
    for (const k of keys) {
      value = value?.[k];
    }

    if (typeof value !== "string") return key;

    // Thay thế biến {country}
    let finalString = value;
    Object.entries(variables).forEach(([k, v]) => {
      finalString = finalString.replace(`{${k}}`, v);
    });

    return finalString;
  } catch (error) {
    console.error("Translation Error:", error);
    return key;
  }
}

const formatCountryName = (slug: string) => {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country, lang } = await params;
  const locale = lang || "en"; // Default về en nếu không tìm thấy
  
  const countryName = formatCountryName(country);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://owsim.com";

  // Gọi hàm dịch thủ công
  const title = await getTranslationServer(locale, "metadata.title", { country: countryName });
  const description = await getTranslationServer(locale, "metadata.description", { country: countryName });

  return {
    title: title,
    description: description,
    alternates: {
      canonical: `${baseUrl}/${locale}/esim/${country}`,
      languages: {
        'vi-VN': `${baseUrl}/vi/esim/${country}`,
        'en-US': `${baseUrl}/en/esim/${country}`,
        'de-DE': `${baseUrl}/de/esim/${country}`,
        'fr-FR': `${baseUrl}/fr/esim/${country}`,
      },
    },
    openGraph: {
      title: title,
      description: description,
      url: `${baseUrl}/${locale}/esim/${country}`,
      siteName: "OpenWorld eSIM",
      images: [
        {
          url: `${baseUrl}/api/og?country=${country}&lang=${locale}`,
          width: 1200,
          height: 630,
          alt: `eSIM ${countryName}`,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: title,
      description: description,
      images: [`${baseUrl}/api/og?country=${country}&lang=${locale}`],
    },
  };
}




export default async function Page({ params }: Props) {
  const resolvedParams = await params;
  const { country, lang } = resolvedParams;
  const countryName = formatCountryName(country);
  const locale = lang || "en";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://owsim.com";

  const descriptions: Record<string, string> = {
    en: `Get the best high-speed 4G/5G eSIM for ${countryName}. Instant activation, no roaming fees. Stay connected while traveling.`,
    vi: `Mua eSIM du lịch ${countryName} tốc độ cao 4G/5G. Kích hoạt tức thì, không phí chuyển vùng. Kết nối internet mọi nơi.`,
    de: `Holen Sie sich die beste Highspeed-4G/5G-eSIM für ${countryName}. Sofortige Aktivierung, keine Roaming-Gebühren.`,
    fr: `Obtenez la meilleure eSIM 4G/5G haut débit pour ${countryName}. Activation instantanée, pas de frais d'itinérance.`, // Đã sửa "pour"
  };

  const selectedDesc = descriptions[locale] || descriptions["en"];
  const h1Titles: Record<string, string> = {
  en: `eSIM ${countryName} - High-speed Travel Data Plans`,
  vi: `eSIM du lịch ${countryName} - Kết nối 4G/5G tốc độ cao`,
  de: `eSIM ${countryName} - Highspeed-Reisedatenpläne`,
  fr: `eSIM ${countryName} - Forfaits de données de voyage haut débit`,
};

const selectedH1 = h1Titles[locale] || h1Titles["en"];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": `eSIM ${countryName} - OpenWorld`,
    "image": `${baseUrl}/api/og?country=${country}&lang=${locale}`,
    "description": selectedDesc,
    "brand": {
      "@type": "Brand",
      "name": "OpenWorld eSIM"
    },
    "sku": `ESIM-${country.toUpperCase()}`,
    "offers": {
      "@type": "AggregateOffer",
      "url": `${baseUrl}/${locale}/esim/${country}`,
      "priceCurrency": "USD",
      "lowPrice": "1.90", 
      "highPrice": "59.00",
      "offerCount": "15",
      "priceValidUntil": "2026-12-31", // Đã cập nhật năm 2026
      "itemCondition": "https://schema.org/NewCondition",
      "availability": "https://schema.org/InStock",
      "seller": {
        "@type": "Organization",
        "name": "OpenWorld eSIM"
      }
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "156"
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      <main>
        {/* H1 này rất quan trọng để Bot Google hiểu nội dung chính ngay lập tức */}
        <h1 className="sr-only">{selectedH1}</h1>
        <EsimCountryClient params={Promise.resolve(resolvedParams)} />
      </main>
    </>
  );
}
import { Metadata } from "next";
import PlansClient from "./PlansClient";

type Props = {
  params: Promise<{ lang: string }>;
};

// 1. Metadata cho Google Search (Title/Desc)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://owsim.com';

  const seo: Record<string, { title: string; desc: string }> = {
    en: {
      title: "Global eSIM Plans | Instant 4G/5G Connectivity in 190+ Countries",
      desc: "Compare and buy the best-value travel eSIM plans. Unlimited data options, instant QR delivery, and premium 5G networks worldwide.",
    },
    vi: {
      title: "Gói Cước eSIM Quốc Tế | Data 4G/5G Tốc Độ Cao Tại 190+ Quốc Gia",
      desc: "Tổng hợp các gói cước eSIM du lịch tốt nhất. Kích hoạt tức thì qua QR, mạng 5G cực nhanh, giải pháp tiết kiệm nhất.",
    },
    de: {
      title: "Globale eSIM-Tarife | Beste Reisedaten für 190+ Länder",
      desc: "Entdecken Sie die besten eSIM-Tarife für Ihre Reise. Sofortige Aktivierung, 5G-Geschwindigkeit weltweit.",
    },
    fr: {
      title: "Forfaits eSIM Mondiaux | Connectivité 4G/5G Instantanée dans 190+ Pays",
      desc: "Comparez et achetez les meilleurs forfaits eSIM de voyage. Options de données illimitées, réseaux 5G premium.",
    },
  };

  const current = seo[lang] || seo.en;

  return {
    title: current.title,
    description: current.desc,
    alternates: {
      canonical: `${baseUrl}/${lang}/plans`,
      languages: {
        'en-US': `${baseUrl}/en/plans`,
        'vi-VN': `${baseUrl}/vi/plans`,
        'fr-FR': `${baseUrl}/fr/plans`,
        'de-DE': `${baseUrl}/de/plans`,
        'x-default': `${baseUrl}/en/plans`,
      },
    },
  };
}

// 2. Server Component chính
export default async function Page({ params }: Props) {
  const resolvedParams = await params;
  const { lang } = resolvedParams;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://owsim.com';

  const headlines: Record<string, string> = {
    en: "Premium Global Travel eSIM Plans - 190+ Countries",
    vi: "Gói Cước eSIM Du Lịch Quốc Tế 4G/5G - 190+ Quốc Gia",
    de: "Premium Reise-eSIM-Tarife | Über 190 Länder Weltweit",
    fr: "Forfaits eSIM Voyage Premium | Plus de 190 Pays",
  };

  const selectedH1 = headlines[lang] || headlines.en;

  // 3. JSON-LD (Dữ liệu có cấu trúc cho danh sách sản phẩm)
  // Mày có thể thêm các quốc gia hot nhất vào đây để Google index nhanh
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": selectedH1,
    "description": "List of available travel eSIM plans for international travelers",
    "url": `${baseUrl}/${lang}/plans`,
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "eSIM Japan",
        "url": `${baseUrl}/${lang}/esim/japan`
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "eSIM Thailand",
        "url": `${baseUrl}/${lang}/esim/thailand`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": "eSIM united-states",
        "url": `${baseUrl}/${lang}/esim/united-states`
      }
    ]
  };

  return (
    <>
      {/* Chèn JSON-LD vào Head */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      <main>
        {/* H1 ẩn chuẩn SEO theo từng ngôn ngữ */}
        <h1 className="sr-only">{selectedH1}</h1>
        
        {/* Component xử lý logic hiển thị */}
        <PlansClient params={resolvedParams} />
      </main>
    </>
  );
}
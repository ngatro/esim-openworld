import { Metadata } from "next";
import BlogClient from "./BlogClient";

type Props = {
  params: Promise<{ lang: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://owsim.com';

  const seo: Record<string, { title: string; desc: string }> = {
    en: {
      title: "eSIM Travel Blog | Expert Guides & Connectivity Tips",
      desc: "Stay updated with the latest travel tips, eSIM installation guides, and network reviews for 190+ countries. Travel smarter with OpenWorld eSIM.",
    },
    vi: {
      title: "Blog eSIM Du Lịch | Hướng Dẫn & Mẹo Kết Nối Quốc Tế",
      desc: "Cập nhật kinh nghiệm du lịch, hướng dẫn cài đặt eSIM và review mạng viễn thông tại 190+ quốc gia. Kết nối dễ dàng cùng OpenWorld eSIM.",
    },
    de: {
      title: "eSIM Reise-Blog | Experten-Guides & Tipps",
      desc: "Erfahren Sie alles über Reise-eSIMs, Installationsanleitungen und Tipps für über 190 Länder weltweit.",
    },
    fr: {
      title: "Blog eSIM Voyage | Guides Experts & Conseils",
      desc: "Découvrez les derniers conseils de voyage, guides d'installation eSIM et actualités pour plus de 190 pays.",
    }
  };

  const current = seo[lang] || seo.en;

  return {
    title: current.title,
    description: current.desc,
    alternates: {
      canonical: `${baseUrl}/${lang}/blog`,
      languages: {
        'en-US': `${baseUrl}/en/blog`,
        'vi-VN': `${baseUrl}/vi/blog`,
        'fr-FR': `${baseUrl}/fr/blog`,
        'de-DE': `${baseUrl}/de/blog`,
        'x-default': `${baseUrl}/en/blog`,
      },
    },
  };
}

export default async function Page({ params }: Props) {
  const resolvedParams = await params;
  const { lang } = resolvedParams;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://owsim.com';

  // 1. Định nghĩa nội dung cho 4 ngôn ngữ (Dùng chung cho H1 và JSON-LD)
  const content: Record<string, { h1: string; desc: string }> = {
    en: {
      h1: "Global Travel eSIM Guide & Connectivity Blog",
      desc: "Expert insights on eSIM technology and international travel connectivity."
    },
    vi: {
      h1: "Cẩm Nang Du Lịch & Hướng Dẫn Sử Dụng eSIM Quốc Tế",
      desc: "Chuyên mục chia sẻ kinh nghiệm du lịch và công nghệ eSIM toàn cầu."
    },
    de: {
      h1: "Globaler Reise-eSIM-Leitfaden & Konnektivitäts-Blog",
      desc: "Expertenwissen über eSIM-Technologie und internationale Reisekonnektivität."
    },
    fr: {
      h1: "Guide eSIM Voyage Mondial & Blog de Connectivité",
      desc: "Découvrez les derniers conseils de voyage, guides d'installation eSIM et actualités pour plus de 190 pays."
    }
  };

  const selected = content[lang] || content.en;

  // 2. JSON-LD chuẩn 4 ngôn ngữ
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": selected.h1,
    "description": selected.desc,
    "publisher": {
      "@type": "Organization",
      "name": "OpenWorld eSIM",
      "logo": {
        "@type": "ImageObject",
        "url": `${baseUrl}/logo.png`
      }
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      <main>
        {/* H1 ẨN - CHUẨN 4 NGÔN NGỮ ĐÃ FIX */}
        <h1 className="sr-only">{selected.h1}</h1>

        <BlogClient params={resolvedParams} />
        
      </main>
    </>
  );
}
import { Metadata } from "next";
import PlansSection from "@/components/sections/PlansSection";
import DeviceCompatibility from "@/components/sections/DeviceCompatibility";
import Comparison from "@/components/sections/Comparison";
import Coverage from "@/components/sections/Coverage";
import Testimonials from "@/components/sections/Testimonials";
import TrustBadges from "@/components/sections/TrustBadges";
import WhyChoose from "@/components/sections/WhyChoose";
import FAQ from "@/components/sections/FAQ";
import Partners from "@/components/sections/Partners";
import Hero from "@/components/sections/Hero";
import HowItWorks from "@/components/sections/HowItWorks";
import ReadyStayConnected from "@/components/sections/ReadyStayConnected";


export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://domain.com';

  const seoData: Record<string, { title: string; description: string }> = {
    vi: {
      title: "eSIM Du Lịch Quốc Tế (190+ Nước) - Kết Nối Ngay | OpenWorld",
      description: "Mua eSIM du lịch quốc tế giá rẻ, không phí chuyển vùng. Nhận QR code qua Email và kích hoạt mạng 4G/5G tức thì tại 190+ quốc gia. Khám phá ngay!",
    },
    en: {
      title: "Global Travel eSIM: Instant 4G/5G in 190+ Countries | OpenWorld",
      description: "Get your travel eSIM online and stay connected worldwide. No physical SIM needed, no roaming fees. Instant delivery & easy activation in 190+ countries.",
    },
    de: {
      title: "Reise eSIM Shop: Weltweit Internet in 190+ Ländern | OpenWorld",
      description: "Bestellen Sie Ihre Reise-eSIM online. Schnelles 4G/5G Internet in über 190 Ländern ohne Roaming-Gebühren. Sofortige Aktivierung per QR-Code.",
    },
    fr: {
      title: "eSIM Voyage Internationale: Internet dans 190+ Pays | OpenWorld",
      description: "Obtenez votre eSIM de voyage sans frais d'itinérance. Connexion 4G/5G instantanée dans plus de 190 pays. Livraison immédiate par e-mail.",
    }
  };

  const currentSeo = seoData[lang] || seoData['en'];

  return {
    title: currentSeo.title,
    description: currentSeo.description,
    alternates: {
      canonical: `${baseUrl}/${lang}`,
      languages: {
        'vi-VN': `${baseUrl}/vi`,
        'en-US': `${baseUrl}/en`,
        'de-DE': `${baseUrl}/de`,
        'fr-FR': `${baseUrl}/fr`,
        'x-default': `${baseUrl}/en`,
      },
    },
    openGraph: {
      title: currentSeo.title,
      description: currentSeo.description,
      url: `${baseUrl}/${lang}`,
      siteName: 'OpenWorld eSIM',
      type: 'website',
      images: [
        {
          url: `${baseUrl}/images/og-home.jpg`, // Nên có ảnh riêng cho trang chủ
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}


export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <main>
        
        <Hero />

        <TrustBadges />
        <Coverage />
        <WhyChoose />
        <Comparison />
        <DeviceCompatibility />
        <Testimonials />
        <HowItWorks />
        <PlansSection />
        <Partners />
        <FAQ />
        <ReadyStayConnected />

        
      </main>
    </div>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import { prisma } from "@/lib/prisma";
import { DEFAULT_RATES, type ExchangeRates } from "@/lib/currency";
import { I18nProvider, type Locale } from "@/components/providers/I18nProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { CartProvider } from "@/components/providers/CartProvider";
import { UIProvider } from "@/components/providers/UIProvider";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import LoginModal from "@/components/ui/LoginModal";
import RegisterModal from "@/components/ui/RegisterModal";
import ResetPasswordModal from "@/components/ui/ResetPasswordModal";
import CartModal from "@/components/ui/CartModal";
import SupportWidget from "@/components/ui/SupportWidget";
import PromotionPopup from "@/components/promotions/PromotionPopup";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://domain.com';
   
  // Define URLs for each language
  const urls = {
    en: `${baseUrl}/en`,
    de: `${baseUrl}/de`,
    fr: `${baseUrl}/fr`,
    vi: `${baseUrl}/vi`,
  };

  // Define title and description per locale
  const titles: Record<string, string> = {
    en: "OpenWorld eSIM | Travel eSIM for International Trips (190+ Countries)",
    de: "OpenWorld eSIM | Reise-eSIM für internationale Reisen (190+ Länder)",
    fr: "OpenWorld eSIM | eSIM de voyage pour voyages internationaux (190+ pays)",
    vi: "OpenWorld eSIM | eSIM du lịch cho các chuyến đi quốc tế (190+ quốc gia)",
  };

  const descriptions: Record<string, string> = {
    en: "Traveling abroad? Get eSIM data before you go. Avoid roaming fees and stay connected in 190+ countries with instant activation.",
    de: "Reist du ins Ausland? Hol dir eSIM-Daten bevor du gehst. Vermeide Roaming-Gebühren und bleibe in 190+ Ländern verbunden mit sofortiger Aktivierung.",
    fr: "Vous voyagez à l'étranger ? Obtenez des données eSIM avant votre départ. Évitez les frais d'itinérance et restez connecté dans plus de 190 pays avec une activation instantanée.",
    vi: "Du lịch nước ngoài? Nhận dữ liệu eSIM trước khi đi. Tránh phí chuyển vùng dữ liệu và duy trì kết nối trong 190+ quốc gia với kích hoạt ngay lập tức.",
  };

  return {
    title: titles[lang] || titles.en,
    description: descriptions[lang] || descriptions.en,
    icons: {
      icon: "/esim.svg",
      apple: "/apple-touch-icon.png",
    },
    alternates: {
      canonical: `${baseUrl}/${lang}`,
      languages: {
        en: urls.en,
        de: urls.de,
        fr: urls.fr,
        vi: urls.vi,
      },
    },
  };
}

async function getRates(): Promise<ExchangeRates> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: "currency_rates" },
    });
    if (setting?.value) {
      return JSON.parse(setting.value);
    }
  } catch (error) {
    console.error("[Layout] Failed to fetch rates:", error);
  }
  return DEFAULT_RATES;
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const rates = await getRates();
  const session = await getServerSession(authOptions);
   
  return (
    <html lang={lang} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <I18nProvider initialRates={rates} initialLocale={lang as Locale}>
          <AuthProvider session={session}>
            <CartProvider>
              <UIProvider>
                <Header />
                <main>{children}</main>
                <Footer />
                <LoginModal />
                <RegisterModal />
                <ResetPasswordModal />
                <CartModal />
                <SupportWidget />
                <PromotionPopup />
              </UIProvider>
            </CartProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}

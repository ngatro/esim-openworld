import { MetadataRoute } from "next";
import countryToRegionData from "@/data/country-to-region.json";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://owsim.com";
  const languages = ["en", "de", "fr", "vi"];

  try {
    // 1. FETCH DATA (Bọc try-catch riêng từng cái để sập 1 cái không sập cả sàn)
    const [plansRes, blogRes] = await Promise.allSettled([
      fetch(`${BASE_URL}/api/plans`, { next: { revalidate: 3600 } }),
      fetch(`${BASE_URL}/api/blog`, { next: { revalidate: 3600 } })
    ]);

    const plansData = plansRes.status === 'fulfilled' ? await plansRes.value.json() : { plans: [] };
    const blogs = blogRes.status === 'fulfilled' ? await blogRes.value.json() : [];

    const sitemapEntries: MetadataRoute.Sitemap = [];

    // 2. TRANG TĨNH (Home, Plans, Blog, Compatibility)
    languages.forEach((lang) => {
      ["", "/plans", "/blog", "/compatibility"].forEach((path) => {
        sitemapEntries.push({
          url: `${BASE_URL}/${lang}${path}`,
          lastModified: new Date(),
          changeFrequency: "daily",
          priority: path === "" ? 1.0 : 0.8,
        });
      });
    });

    // 3. TRANG BLOG (FIX LỖI UNDEFINED Ở ĐÂY)
    if (Array.isArray(blogs)) {
      blogs.forEach((post: any) => {
        // Kiểm tra tất cả các trường hợp có thể xảy ra của trường ngôn ngữ
        const lang = post.lang || post.locale || post.language || "en";
        const slug = post.slug;

        if (slug && slug !== "undefined") {
          sitemapEntries.push({
            url: `${BASE_URL}/${lang}/blog/${slug}`,
            lastModified: new Date(post.updatedAt || post.publishedAt || new Date()),
            changeFrequency: "weekly",
            priority: 0.7,
          });
        }
      });
    }

    // 4. TRANG QUỐC GIA & VÙNG (Dùng Set để lọc trùng tuyệt đối)
    const uniqueSlugs = new Set<string>();
    
    // Lấy từ file JSON countries
    Object.values(countryToRegionData).forEach((item: any) => {
      const s = item.countryName?.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      if (s) uniqueSlugs.add(s);
    });

    // Thêm các vùng lục địa
    ["global", "asia", "europe", "americas", "oceania", "africa", "middle-east"].forEach(r => uniqueSlugs.add(r));

    uniqueSlugs.forEach((slug) => {
      languages.forEach((lang) => {
        sitemapEntries.push({
          url: `${BASE_URL}/${lang}/esim/${slug}`,
          lastModified: new Date(),
          changeFrequency: "daily",
          priority: 0.9,
        });
      });
    });

    // 5. TRANG CHI TIẾT GÓI CƯỚC (Rút gọn để giảm dung lượng file)
    const plans = plansData.plans || [];
    plans.filter((p: any) => p.slug && p.slug !== "undefined").forEach((plan: any) => {
      // Chỉ tạo link cho 2 ngôn ngữ chính để file không bị quá nặng (gần 2MB là quá tải)
      // Nếu muốn tất cả 4 ngôn ngữ thì đổi ["en", "vi"] thành languages
      ["en", "vi"].forEach((lang) => {
        const countrySlug = plan.countryId?.toLowerCase() || "global";
        sitemapEntries.push({
          url: `${BASE_URL}/${lang}/esim/${countrySlug}/${plan.slug}`,
          lastModified: new Date(plan.updatedAt || new Date()),
          changeFrequency: "weekly",
          priority: 0.5,
        });
      });
    });

    return sitemapEntries;

  } catch (error) {
    console.error("Sitemap Hủy Diệt Error:", error);
    return [{ url: `${BASE_URL}/en`, lastModified: new Date() }];
  }
}
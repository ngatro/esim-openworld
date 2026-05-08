"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { BLOG_CATEGORIES, type BlogPost } from "@/lib/blog-data";
import { useI18n } from "@/components/providers/I18nProvider";

interface BlogClientProps {
  params: {
    lang: string;
  };
}

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function BlogCard({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  const { t, locale } = useI18n();
  const category = BLOG_CATEGORIES.find(c => c.id === post.category);
  
  return (
    <Link href={`/${locale}/blog/${post.slug}`}>
      <motion.article 
        className={`bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-orange-400 hover:shadow-lg transition-all hover:-translate-y-1 ${featured ? 'md:grid md:grid-cols-2 md:gap-6' : ''}`}
        whileHover={{ scale: 1.01 }}
      >
        <div className={`${featured ? 'h-64 md:h-full' : 'h-48'} relative overflow-hidden`}>
          <Image 
            src={post.coverImage} 
            alt={post.title}
            fill // Dùng fill vì container đã có relative và chiều cao cố định
            className="object-cover transition-transform duration-500 hover:scale-110"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={featured} // Ảnh bài viết nổi bật thì cho load ưu tiên
          />
          <div className="absolute inset-0 bg-slate-900/40" />
          <span className="absolute top-4 left-4 bg-orange-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
            {category?.emoji} {t(`blog.categories.${post.category}`)}
          </span>
        </div>
        
        <div className="p-6">
          <h3 className={`font-bold text-slate-800 mb-2 ${featured ? 'text-2xl' : 'text-lg'} line-clamp-2`}>
            {post.title}
          </h3>
          <p className="text-slate-500 text-sm mb-4 line-clamp-2">
            {post.excerpt}
          </p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{post.authorAvatar}</span>
              <span className="text-sm text-slate-500">{post.author}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
              <span>•</span>
              <span>{post.readTime} {t("blog.readTime")}</span>
            </div>
          </div>
        </div>
      </motion.article>
    </Link>
  );
}

export default function BlogClient({ params }: BlogClientProps) {
  const { lang } = params;
  const { t, locale } = useI18n();
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Sử dụng locale từ hook useI18n hoặc lang từ params
        const targetLocale = lang || locale; 
        console.log("Đang fetch blog cho ngôn ngữ:", targetLocale);

        const res = await fetch(`/api/blog?locale=${targetLocale}`);
        if (!res.ok) throw new Error("Failed to fetch posts");
        
        const data = await res.json();
        setPosts(data);
      } catch (error) {
        console.error("Error fetching posts:", error);
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [lang, locale]); // Chạy lại khi đổi ngôn ngữ

  const filteredPosts = posts.filter(post => {
    const matchCategory = activeCategory === "all" || post.category === activeCategory;
    const matchSearch = searchQuery === "" || 
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const featuredPosts = posts.filter(p => p.featured);
  const nonFeaturedPosts = filteredPosts.filter(p => !p.featured);

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-slate-500">{t("blog.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <main>
        <section className="relative pt-24 pb-16 bg-orange-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <FadeIn>
              <div className="text-center">
                <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4">
                  {t("blog.title")}
                </h1>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  {t("blog.subtitle")}
                </p>
              </div>
            </FadeIn>
          </div>
        </section>

        <section className="py-8 bg-orange-50 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => setActiveCategory("all")}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    activeCategory === "all"
                      ? "bg-orange-500 text-white"
                      : "bg-white text-slate-600 hover:text-slate-800 border border-slate-200"
                  }`}
                >
                  {t("blog.categories.all")}
                </button>
                {BLOG_CATEGORIES.map(category => (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      activeCategory === category.id
                        ? "bg-orange-500 text-white"
                        : "bg-white text-slate-600 hover:text-slate-800 border border-slate-200"
                    }`}
                  >
                    {category.emoji} {t(`blog.categories.${category.id}`)}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-64">
                <input
                  type="text"
                  placeholder={t("blog.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl px-4 py-2 pl-10 focus:outline-none focus:border-orange-400"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
        </section>

        {activeCategory === "all" && searchQuery === "" && featuredPosts.length > 0 && (
          <section className="py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-6">{t("blog.featured")}</h2>
              <div className="grid grid-cols-1 gap-6">
                {featuredPosts.slice(0, 2).map((post, index) => (
                  <FadeIn key={post.id} delay={index * 0.1}>
                    <BlogCard post={post} featured />
                  </FadeIn>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">
              {activeCategory === "all" ? t("blog.latest") : t(`blog.categories.${activeCategory}`)}
            </h2>
            
            {filteredPosts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(activeCategory === "all" && searchQuery === "" ? nonFeaturedPosts : filteredPosts).map((post, index) => (
                  <FadeIn key={post.id} delay={index * 0.05}>
                    <BlogCard post={post} />
                  </FadeIn>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-5xl mb-4">🔍</p>
                <p className="text-slate-500 text-lg">{t("blog.noArticles")}</p>
                <button
                  onClick={() => { setActiveCategory("all"); setSearchQuery(""); }}
                  className="mt-4 text-orange-500 hover:text-orange-600"
                >
                  {t("blog.clearFilters")}
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="py-16 bg-cyan-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <FadeIn>
              <h2 className="text-3xl font-bold text-slate-800 mb-4">{t("cta.title")}</h2>
              <p className="text-slate-600 mb-6">
                {t("cta.subtitle")}
              </p>
              <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 bg-white border border-slate-200 text-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400"
                />
                <button
                  type="submit"
                  className="bg-orange-500 hover:bg-orange-400 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
                >
                  {t("blog.subscribe")}
                </button>
              </form>
            </FadeIn>
          </div>
        </section>
      </main>
    </div>
  );
}

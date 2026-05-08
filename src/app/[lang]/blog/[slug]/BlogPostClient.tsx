"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { BLOG_CATEGORIES, type BlogPost } from "@/lib/blog-data";
import { useI18n } from "@/components/providers/I18nProvider";

interface ClientProps {
  params: { lang: string; slug: string };
  initialPost: BlogPost; // Data từ Server truyền xuống
}

export default function BlogPostClient({ params, initialPost }: ClientProps) {
  const { lang, slug } = params;
  const { t, locale } = useI18n();
  
  // Dùng luôn data từ Server làm giá trị khởi tạo, không cần loading nữa
  const [post] = useState<BlogPost>(initialPost);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(true);

  // Chỉ fetch các bài viết liên quan (Related Posts)
  const fetchRelatedPosts = useCallback(async () => {
    try {
      const res = await fetch(`/api/blog?locale=${lang}`);
      if (!res.ok) throw new Error("Failed to fetch posts");
      const allPosts: BlogPost[] = await res.json();
      const related = allPosts
        .filter(p => p.id !== initialPost.id && p.category === initialPost.category)
        .slice(0, 3);
      setRelatedPosts(related);
    } catch (error) {
      console.error("Error fetching related posts:", error);
    } finally {
      setLoadingRelated(false);
    }
  }, [lang, initialPost.id, initialPost.category]);

  useEffect(() => {
    fetchRelatedPosts();
  }, [fetchRelatedPosts]);

  const category = BLOG_CATEGORIES.find(c => c.id === post.category);

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <main>
        {/* Section Banner - Dùng Next.js Image chuẩn SEO */}
        <section className="relative h-[50vh] min-h-[400px] overflow-hidden">
          <Image 
            src={post.coverImage} 
            alt={post.title}
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-slate-900/60" />
          
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <div className="max-w-4xl mx-auto">
              <Link 
                href={`/${lang}/blog`} 
                className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 mb-4 font-medium"
              >
                ← {t("common.back")}
              </Link>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <span className="inline-block bg-orange-500 text-white text-sm font-semibold px-3 py-1 rounded-full mb-4">
                  {category?.emoji} {t(`blog.categories.${post.category}`)}
                </span>
                
                {/* H1  cho SEO - Không dùng sr-only ở đây */}
                <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight">
                  {post.title}
                </h1>
                
                <div className="flex flex-wrap items-center gap-4 text-slate-300 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{post.authorAvatar}</span>
                    <span className="font-medium text-white">{post.author}</span>
                  </div>
                  <span>•</span>
                  <span>{new Date(post.publishedAt).toLocaleDateString(lang)}</span>
                  <span>•</span>
                  <span>{post.readTime} {t("blog.readTime")}</span>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Nội dung bài viết */}
        <section className="py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.article 
              className="prose prose-lg prose-slate max-w-none prose-headings:text-slate-800 prose-orange"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <p className="text-xl text-slate-600 mb-8 font-medium italic border-l-4 border-orange-500 pl-4">
                {post.excerpt}
              </p>
              
              <div className="space-y-6 text-slate-700 leading-relaxed">
                {post.content.split('\n').map((line, index) => {
                  if (line.startsWith('# ')) return <h1 key={index}>{line.slice(2)}</h1>;
                  if (line.startsWith('## ')) return <h2 key={index}>{line.slice(3)}</h2>;
                  if (line.startsWith('### ')) return <h3 key={index}>{line.slice(4)}</h3>;
                  if (line.startsWith('- ')) return <li key={index} className="ml-4">{line.slice(2)}</li>;
                  if (line.trim() === '') return <div key={index} className="h-2" />;
                  return <p key={index}>{line}</p>;
                })}
              </div>
            </motion.article>

            {/* Tags */}
            <div className="mt-12 pt-8 border-t border-slate-100 flex flex-wrap gap-2">
              {(post.tags || []).map(tag => (
                <span key={tag} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-sm hover:bg-orange-100 hover:text-orange-600 transition-colors cursor-default">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Bài viết liên quan */}
        {relatedPosts.length > 0 && (
          <section className="py-16 bg-slate-50 border-t border-slate-100">
            <div className="max-w-7xl mx-auto px-4">
              <h2 className="text-2xl font-bold text-slate-800 mb-8">{t("blog.latest")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {relatedPosts.map((relatedPost) => (
                  <Link key={relatedPost.id} href={`/${lang}/blog/${relatedPost.slug}`} className="group">
                    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-xl hover:border-orange-200 transition-all duration-300">
                      <div className="relative h-48">
                        <Image
                          src={relatedPost.coverImage} 
                          alt={relatedPost.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      <div className="p-5">
                        <h3 className="font-bold text-slate-800 line-clamp-2 group-hover:text-orange-600 transition-colors mb-2">
                          {relatedPost.title}
                        </h3>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                          {relatedPost.readTime} {t("blog.readTime")}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
import { Metadata } from "next";
import { notFound } from "next/navigation";
import BlogPostClient from "./BlogPostClient";
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ lang: string; slug: string }>;
};

// 1. SEO Metadata: Tự động lấy title và excerpt của bài viết làm Metadata
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://owsim.com';

  // Fetch dữ liệu từ API của mày để lấy thông tin bài viết
  const res = await fetch(`${baseUrl}/api/blog/${slug}?locale=${lang}`, {
    cache: 'no-store'       // Luôn lấy dữ liệu mới nhất, không cache để tránh SEO bị lỗi khi bài viết mới được cập nhật
  });
  // NẾU KHÔNG TÌM THẤY BÀI VIẾT (VÍ DỤ KHI ĐỔI LANG)
  if (!res.ok) {
    // Thay vì notFound(), ta điều hướng về danh sách blog của ngôn ngữ hiện tại
    redirect(`/${lang}/blog`);
  }

  if (!res.ok) {
  const titles: Record<string, string> = {
    en: "Article Not Found",
    vi: "Không tìm thấy bài viết",
    de: "Artikel nicht gefunden",
    fr: "Article non trouvé"
  };
  return { 
    title: titles[lang] || titles.en 
  };
}
  
  const post = await res.json();

  return {
    title: `${post.title} | OpenWorld eSIM Blog`,
    description: post.excerpt,
    alternates: {
      canonical: `${baseUrl}/${lang}/blog/${slug}`,
      languages: {
        'en-US': `${baseUrl}/en/blog/${slug}`,
        'vi-VN': `${baseUrl}/vi/blog/${slug}`,
        'fr-FR': `${baseUrl}/fr/blog/${slug}`,
        'de-DE': `${baseUrl}/de/blog/${slug}`,
      },
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: [{ url: post.coverImage }],
      type: "article",
      publishedTime: post.publishedAt,
      authors: [post.author],
    },
  };
}

export default async function Page({ params }: Props) {
  const resolvedParams = await params;
  const { lang, slug } = resolvedParams;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://owsim.com';

  const res = await fetch(`${baseUrl}/api/blog/${slug}?locale=${lang}`);
  if (!res.ok) notFound();
  const post = await res.json();

  // 2. Schema Article: Cực kỳ quan trọng để lên Google News và hiện ảnh đại diện trên Google
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "image": post.coverImage,
    "datePublished": post.publishedAt,
    "author": { "@type": "Person", "name": post.author },
    "description": post.excerpt,
    "publisher": {
      "@type": "Organization",
      "name": "OpenWorld eSIM",
      "logo": { "@type": "ImageObject", "url": `${baseUrl}/logo.png` }
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Không dùng sr-only ở đây vì bài viết cần H1 hiển thị cho người dùng đọc */}
      <BlogPostClient params={resolvedParams} initialPost={post} />
    </>
  );
}
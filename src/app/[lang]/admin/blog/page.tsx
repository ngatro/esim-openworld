"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BLOG_CATEGORIES, type BlogPost } from "@/lib/blog-data";
import { SUPPORTED_LOCALES, type Locale, useI18n } from "@/components/providers/I18nProvider";
import { useAuth } from "@/components/providers/AuthProvider";

function generateId(): string {
  return `blog-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function BlogAdminPage() {
   const { locale } = useI18n();
   const router = useRouter();
   const { user, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Redirect if not admin (after auth loaded)
  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  // Fetch posts from API only when admin is authenticated
  useEffect(() => {
    if (!authLoading && user?.role === "admin") {
      fetchPosts();
    }
  }, [user, authLoading]);

  async function fetchPosts() {
    try {
      const res = await fetch("/api/admin/blog", {
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Failed to fetch posts");
      const data = await res.json();
      setPosts(data);
    } catch (err) {
      setError("Failed to load posts");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const emptyPost: Omit<BlogPost, 'id'> = {
    slug: '',
    title: '',
    excerpt: '',
    content: '',
    author: '',
    authorAvatar: '👤',
    category: 'travel',
    tags: [],
    coverImage: 'https://images.unsplash.com/photo-1523961131990-5ea7c61b2107?w=800',
    publishedAt: new Date().toISOString().split('T')[0],
    readTime: 5,
    featured: false,
    locales: ['en'],
  };

  const filteredPosts = posts.filter(post =>
    post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.excerpt?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function handleNew() {
    setEditingPost({ ...emptyPost, id: generateId() } as BlogPost);
    setIsEditing(true);
  }

  function handleEdit(post: BlogPost) {
    setEditingPost({ ...post });
    setIsEditing(true);
  }

  async function handleSave() {
    if (!editingPost) return;
    setSaving(true);

    try {
      let updatedPost = { ...editingPost };
      if (updatedPost.slug === '') {
        updatedPost.slug = generateSlug(updatedPost.title);
      }

      // Prepare data for API
      const postData = {
        id: updatedPost.id,
        title: updatedPost.title,
        slug: updatedPost.slug,
        excerpt: updatedPost.excerpt,
        content: updatedPost.content,
        coverImage: updatedPost.coverImage,
        category: updatedPost.category,
        tags: updatedPost.tags,
        author: updatedPost.author,
        authorAvatar: updatedPost.authorAvatar,
        readTime: updatedPost.readTime,
        featured: updatedPost.featured,
        locales: updatedPost.locales || ['en'],
        isPublished: true, // Always publish for now
      };

      const isEditingExisting = posts.some(p => p.id === updatedPost.id);
      const url = isEditingExisting ? "/api/admin/blog" : "/api/admin/blog";
      const method = isEditingExisting ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postData),
        credentials: 'include'
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save post");
      }

      const savedPost = await res.json();

      if (isEditingExisting) {
        setPosts(posts.map(p => p.id === savedPost.id ? savedPost : p));
      } else {
        setPosts([savedPost, ...posts]);
      }

      setIsEditing(false);
      setEditingPost(null);
    } catch (error) {
      console.error("Error saving post:", error);
      alert(error instanceof Error ? error.message : "Failed to save post");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      const res = await fetch(`/api/admin/blog?id=${id}`, {
        method: "DELETE",
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Failed to delete post");
      setPosts(posts.filter(p => p.id !== id));
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting post:", error);
      alert("Failed to delete post");
    }
  }

  function handleCancel() {
    setIsEditing(false);
    setEditingPost(null);
  }

  // Handle locale checkbox change
  function handleLocaleChange(locale: string, checked: boolean) {
    if (!editingPost) return;
    const currentLocales = editingPost.locales || ['en'];
    let newLocales: string[];
    if (checked) {
      newLocales = [...currentLocales, locale];
    } else {
      newLocales = currentLocales.filter(l => l !== locale);
      // Ensure at least one locale remains
      if (newLocales.length === 0) {
        newLocales = ['en'];
      }
    }
    setEditingPost({ ...editingPost, locales: newLocales });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading posts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={fetchPosts} className="bg-sky-500 hover:bg-sky-400 px-4 py-2 rounded">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href={`/${locale}/admin`} className="text-sky-400 hover:text-sky-300 text-sm mb-2 inline-flex items-center gap-1">
              ← Back to Admin
            </Link>
            <h1 className="text-3xl font-bold">Blog Management</h1>
          </div>
          <button
            onClick={handleNew}
            className="bg-sky-500 hover:bg-sky-400 text-white px-6 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Post
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-64 bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2 focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Posts Table */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800 border-b border-slate-700">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-400">Post</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-400">Category</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-400">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-400">Languages</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-400">Date</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredPosts.map((post) => (
                  <tr key={post.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <img 
                          src={post.coverImage} 
                          alt={post.title}
                          className="w-16 h-12 object-cover rounded-lg"
                        />
                        <div>
                          <p className="font-medium text-white line-clamp-1">{post.title}</p>
                          <p className="text-sm text-slate-500 line-clamp-1">{post.excerpt}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-700 text-slate-300 px-3 py-1 rounded-full text-sm">
                        {BLOG_CATEGORIES.find(c => c.id === post.category)?.emoji} {post.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {post.featured && (
                          <span className="bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded text-xs font-medium">
                            Featured
                          </span>
                        )}
                        <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs font-medium">
                          Published
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(post.locales || ['en']).map((loc) => {
                          const localeInfo = SUPPORTED_LOCALES.find(l => l.code === loc);
                          return (
                            <span key={loc} className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-xs">
                              {localeInfo?.flag} {loc}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-sm">
                      {new Date(post.publishedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(post)}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(post.id)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredPosts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-400">No posts found</p>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        <AnimatePresence>
          {isEditing && editingPost && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-slate-800 rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
              >
                <h2 className="text-2xl font-bold mb-6">
                  {posts.find(p => p.id === editingPost.id) ? 'Edit Post' : 'New Post'}
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Title</label>
                    <input
                      type="text"
                      value={editingPost.title}
                      onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-sky-500"
                      placeholder="Post title"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Slug</label>
                      <input
                        type="text"
                        value={editingPost.slug}
                        onChange={(e) => setEditingPost({ ...editingPost, slug: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-sky-500"
                        placeholder="post-url-slug"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Category</label>
                      <select
                        value={editingPost.category}
                        onChange={(e) => setEditingPost({ ...editingPost, category: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-sky-500"
                      >
                        {BLOG_CATEGORIES.map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.emoji} {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Excerpt</label>
                    <textarea
                      value={editingPost.excerpt}
                      onChange={(e) => setEditingPost({ ...editingPost, excerpt: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-sky-500 h-24"
                      placeholder="Short description..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Content (Markdown)</label>
                    <textarea
                      value={editingPost.content}
                      onChange={(e) => setEditingPost({ ...editingPost, content: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-sky-500 h-64 font-mono text-sm"
                      placeholder="Post content..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Author Name</label>
                      <input
                        type="text"
                        value={editingPost.author || ''}
                        onChange={(e) => setEditingPost({ ...editingPost, author: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Author Avatar (emoji)</label>
                      <input
                        type="text"
                        value={editingPost.authorAvatar || ''}
                        onChange={(e) => setEditingPost({ ...editingPost, authorAvatar: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Cover Image URL</label>
                      <input
                        type="text"
                        value={editingPost.coverImage || ''}
                        onChange={(e) => setEditingPost({ ...editingPost, coverImage: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Read Time (minutes)</label>
                      <input
                        type="number"
                        value={editingPost.readTime}
                        onChange={(e) => setEditingPost({ ...editingPost, readTime: parseInt(e.target.value) || 5 })}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Tags (comma separated)</label>
                      <input
                        type="text"
                        value={editingPost.tags?.join(', ') || ''}
                        onChange={(e) => setEditingPost({ ...editingPost, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-sky-500"
                        placeholder="tag1, tag2, tag3"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Published Date</label>
                      <input
                        type="date"
                        value={editingPost.publishedAt?.split('T')[0] || ''}
                        onChange={(e) => setEditingPost({ ...editingPost, publishedAt: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  {/* Language Selection */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Available Languages</label>
                    <div className="flex flex-wrap gap-3">
                      {SUPPORTED_LOCALES.map((locale) => {
                        const isChecked = editingPost.locales?.includes(locale.code) || false;
                        return (
                          <label
                            key={locale.code}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => handleLocaleChange(locale.code, e.target.checked)}
                              className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-sky-500"
                            />
                            <span className="text-lg">{locale.flag}</span>
                            <span className="text-sm">{locale.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Select the languages in which this blog post will be available.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="featured"
                      checked={editingPost.featured}
                      onChange={(e) => setEditingPost({ ...editingPost, featured: e.target.checked })}
                      className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-sky-500"
                    />
                    <label htmlFor="featured" className="text-slate-300">Featured post</label>
                  </div>

                  {/* Preview Image */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Cover Image Preview</label>
                    <img 
                      src={editingPost.coverImage} 
                      alt="Preview"
                      className="w-full h-48 object-cover rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-700">
                  <button
                    onClick={handleCancel}
                    className="px-6 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-sky-500 hover:bg-sky-400 text-white px-6 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Save Post'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-slate-800 rounded-2xl p-6 w-full max-w-md"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                <h3 className="text-xl font-bold text-white mb-2">Delete Post?</h3>
                <p className="text-slate-400 mb-6">
                  This action cannot be undone. Are you sure you want to delete this post?
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className="px-6 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(showDeleteConfirm)}
                    className="bg-red-500 hover:bg-red-400 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Destination {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  landmark: string | null;
  imageUrl: string | null;
  isVisible: boolean;
  priority: number;
}

interface DestinationRegion {
  id: string;
  name: string;
  emoji: string;
  imageUrl: string | null;
  isVisible: boolean;
  priority: number;
}

const DEFAULT_DESTINATIONS: Omit<Destination, "landmark" | "imageUrl">[] = [
  { id: "JP", name: "Japan", slug: "japan", emoji: "🇯🇵", isVisible: true, priority: 1 },
  { id: "KR", name: "Korea", slug: "south-korea", emoji: "🇰🇷", isVisible: true, priority: 2 },
  { id: "TH", name: "Thailand", slug: "thailand", emoji: "🇹🇭", isVisible: true, priority: 3 },
  { id: "SG", name: "Singapore", slug: "singapore", emoji: "🇸🇬", isVisible: true, priority: 4 },
  { id: "VN", name: "Vietnam", slug: "vietnam", emoji: "🇻🇳", isVisible: true, priority: 5 },
  { id: "US", name: "USA", slug: "united-states", emoji: "🇺🇸", isVisible: true, priority: 6 },
  { id: "GB", name: "UK", slug: "united-kingdom", emoji: "🇬🇧", isVisible: true, priority: 7 },
  { id: "FR", name: "France", slug: "france", emoji: "🇫🇷", isVisible: true, priority: 8 },
  { id: "DE", name: "Germany", slug: "germany", emoji: "🇩🇪", isVisible: true, priority: 9 },
  { id: "CN", name: "China", slug: "china", emoji: "🇨🇳", isVisible: true, priority: 10 },
  { id: "HK", name: "Hong Kong", slug: "hong-kong", emoji: "🇭🇰", isVisible: true, priority: 11 },
  { id: "TW", name: "Taiwan", slug: "taiwan", emoji: "🇹🇼", isVisible: true, priority: 12 },
  { id: "MY", name: "Malaysia", slug: "malaysia", emoji: "🇲🇾", isVisible: true, priority: 13 },
  { id: "ID", name: "Indonesia", slug: "indonesia", emoji: "🇮🇩", isVisible: true, priority: 14 },
  { id: "AU", name: "Australia", slug: "australia", emoji: "🇦🇺", isVisible: true, priority: 15 },
  { id: "IT", name: "Italy", slug: "italy", emoji: "🇮🇹", isVisible: true, priority: 16 },
  { id: "ES", name: "Spain", slug: "spain", emoji: "🇪🇸", isVisible: true, priority: 17 },
  { id: "NL", name: "Netherlands", slug: "netherlands", emoji: "🇳🇱", isVisible: true, priority: 18 },
  { id: "CH", name: "Switzerland", slug: "switzerland", emoji: "🇨🇭", isVisible: true, priority: 19 },
  { id: "AE", name: "UAE", slug: "united-arab-emirates", emoji: "🇦🇪", isVisible: true, priority: 20 },
];

const DEFAULT_REGIONS = [
  { id: "global", name: "Global", emoji: "🌍", isVisible: true, priority: 0 },
  { id: "asia", name: "Asia", emoji: "🌏", isVisible: true, priority: 1 },
  { id: "europe", name: "Europe", emoji: "🏰", isVisible: true, priority: 2 },
  { id: "americas", name: "Americas", emoji: "🗽", isVisible: true, priority: 3 },
  { id: "middle-east", name: "Middle East", emoji: "🕌", isVisible: true, priority: 4 },
  { id: "oceania", name: "Oceania", emoji: "🏝️", isVisible: true, priority: 5 },
  { id: "africa", name: "Africa", emoji: "🦁", isVisible: true, priority: 6 },
];

export default function AdminDestinationsPage() {
  const router = useRouter();

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [regions, setRegions] = useState<DestinationRegion[]>([]);
  const [activeTab, setActiveTab] = useState<"destination" | "region">("destination");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state for editing
  const [editingDest, setEditingDest] = useState<Destination | null>(null);
  const [editingRegion, setEditingRegion] = useState<DestinationRegion | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Check auth
  useEffect(() => {
    // Simple check via API
    fetch("/api/auth/me")
      .then(res => {
        if (!res.ok) {
          router.push("/login");
        }
        return res.json();
      })
      .then(data => {
        if (!data.user || data.user.role !== "admin") {
          router.push("/");
        }
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const res = await fetch("/api/admin/destinations", {
        credentials: 'include'
      });
      const data = await res.json();
      setDestinations(data.destinations || []);
      setRegions(data.regions || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(data: FormData, type: "destination" | "region") {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/destinations", {
        method: "POST",
        body: data,
        credentials: 'include'
      });

      const result = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: `${type === "destination" ? "Destination" : "Region"} saved successfully!` });
        fetchData();
        setShowModal(false);
        setEditingDest(null);
        setEditingRegion(null);
      } else {
        setMessage({ type: "error", text: result.error || "Failed to save" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleVisibility(item: Destination | DestinationRegion, type: "destination" | "region") {
    const formData = new FormData();
    formData.append("type", type);
    formData.append("id", item.id);
    formData.append("name", item.name);
    formData.append("emoji", item.emoji);
    formData.append("isVisible", (!item.isVisible).toString());
    formData.append("priority", item.priority.toString());

    if (type === "destination") {
      const dest = item as Destination;
      formData.append("slug", dest.slug);
      formData.append("landmark", dest.landmark || "");
    }

    await handleSave(formData, type);
  }

  async function handleDelete(id: string, type: "destination" | "region") {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;

    try {
      const res = await fetch(`/api/admin/destinations?type=${type}&id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Deleted successfully!" });
        fetchData();
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to delete" });
    }
  }

  async function handleInitDefaults() {
    setSaving(true);
    setMessage(null);

    try {
      // Initialize destinations
      for (const dest of DEFAULT_DESTINATIONS) {
        const formData = new FormData();
        formData.append("type", "destination");
        formData.append("id", dest.id);
        formData.append("name", dest.name);
        formData.append("slug", dest.slug);
        formData.append("emoji", dest.emoji);
        formData.append("landmark", "");
        formData.append("isVisible", dest.isVisible.toString());
        formData.append("priority", dest.priority.toString());

        await fetch("/api/admin/destinations", {
          method: "POST",
          body: formData,
        });
      }

      // Initialize regions
      for (const region of DEFAULT_REGIONS) {
        const formData = new FormData();
        formData.append("type", "region");
        formData.append("id", region.id);
        formData.append("name", region.name);
        formData.append("emoji", region.emoji);
        formData.append("isVisible", region.isVisible.toString());
        formData.append("priority", region.priority.toString());

        await fetch("/api/admin/destinations", {
          method: "POST",
          body: formData,
        });
      }

      setMessage({ type: "success", text: "Initialized with defaults!" });
      fetchData();
    } catch (error) {
      setMessage({ type: "error", text: "Failed to initialize" });
    } finally {
      setSaving(false);
    }
  }

  function openEditModal(item?: Destination | DestinationRegion, tabType?: "destination" | "region") {
    const tab = tabType || activeTab;
    if (tab === "destination" && item) {
      setEditingDest(item as Destination);
      setEditingRegion(null);
    } else if (tab === "region" && item) {
      setEditingRegion(item as DestinationRegion);
      setEditingDest(null);
    } else if (tab === "destination") {
      setEditingDest({
        id: "",
        name: "",
        slug: "",
        emoji: "",
        landmark: null,
        imageUrl: null,
        isVisible: true,
        priority: destinations.length + 1,
      });
      setEditingRegion(null);
    } else {
      setEditingRegion({
        id: "",
        name: "",
        emoji: "",
        imageUrl: null,
        isVisible: true,
        priority: regions.length + 1,
      });
      setEditingDest(null);
    }
    setShowModal(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (activeTab === "destination" && editingDest) {
      // Validate required fields
      const name = formData.get("name") as string;
      const slug = formData.get("slug") as string;

      if (!name || !slug) {
        setMessage({ type: "error", text: "Name and slug are required" });
        return;
      }

      // Auto-generate ID from slug if not provided
      let id = formData.get("id") as string;
      if (!id && slug) {
        // Generate a simple ID from the first 2 letters of slug uppercase
        id = slug.substring(0, 2).toUpperCase().replace(/[^A-Z]/g, "") || 
               slug.replace(/[^a-zA-Z]/g, "").substring(0, 2).toUpperCase() || 
               "XX";
        formData.set("id", id);
      }

      handleSave(formData, "destination");
    } else if (activeTab === "region" && editingRegion) {
      // Validate required fields
      if (!editingRegion.id || !editingRegion.name) {
        setMessage({ type: "error", text: "ID and name are required" });
        return;
      }
      handleSave(formData, "region");
    }
  }

  const isDestTab = activeTab === "destination";
  const isRegionTab = activeTab === "region";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Manage Destinations</h1>
            <p className="text-slate-600">Manage top destinations and regions shown on /plans page</p>
          </div>
          <button
            onClick={handleInitDefaults}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Initialize Defaults
          </button>
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-lg ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("destination")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "destination"
                ? "bg-orange-500 text-white"
                : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            Destinations ({destinations.length})
          </button>
          <button
            onClick={() => setActiveTab("region")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "region"
                ? "bg-orange-500 text-white"
                : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            Regions ({regions.length})
          </button>
        </div>

        {/* Add Button */}
        <div className="mb-4">
          <button
            onClick={() => openEditModal()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add {isDestTab ? "Destination" : "Region"}
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Priority</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Emoji</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Name</th>
                {isDestTab && (
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Landmark</th>
                )}
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Image</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Visible</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(isDestTab ? destinations : regions).map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-sm text-slate-600">{item.priority}</td>
                  <td className="px-4 py-3 text-lg">{item.emoji}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{item.name}</td>
                  {isDestTab && (
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {(item as Destination).landmark || "-"}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt="" width={48} height={32} className="object-cover rounded" />
                    ) : (
                      <span className="text-slate-400 text-sm">No image</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleVisibility(item, isDestTab ? "destination" : "region")}
                      className={`px-2 py-1 text-xs rounded-full ${
                        item.isVisible
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {item.isVisible ? "Visible" : "Hidden"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEditModal(item, isDestTab ? "destination" : "region")}
                      className="text-blue-600 hover:text-blue-800 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, isDestTab ? "destination" : "region")}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {(isDestTab ? destinations : regions).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No {activeTab} found. Click &quot;Initialize Defaults&quot; to add default data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-800 mb-4">
              {isDestTab ? "Edit Destination" : "Edit Region"}
            </h2>

            <form onSubmit={handleSubmit}>
              <input type="hidden" name="type" value={activeTab} />

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    ID {isDestTab ? "(auto-filled from slug)" : "(Region ID)"}
                  </label>
                  <input
                    type="text"
                    name="id"
                    defaultValue={isDestTab ? editingDest?.id : editingRegion?.id}
                    required
                    readOnly
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
                    placeholder={isDestTab ? "Auto-generated from slug" : "asia, europe..."}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={isDestTab ? editingDest?.name : editingRegion?.name}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>

                {isDestTab && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Slug (URL)</label>
                    <input
                      type="text"
                      name="slug"
                      defaultValue={editingDest?.slug}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                      placeholder="japan, south-korea..."
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Emoji</label>
                  <input
                    type="text"
                    name="emoji"
                    defaultValue={isDestTab ? editingDest?.emoji : editingRegion?.emoji}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    placeholder="🇯🇵"
                  />
                </div>

                {isDestTab && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Landmark</label>
                    <input
                      type="text"
                      name="landmark"
                      defaultValue={editingDest?.landmark || ""}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                      placeholder="Tokyo Tower, Eiffel Tower..."
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priority (Order)</label>
                  <input
                    type="number"
                    name="priority"
                    defaultValue={isDestTab ? editingDest?.priority : editingRegion?.priority}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Image (JPEG/PNG)</label>
                  <input
                    type="file"
                    name="image"
                    accept="image/jpeg,image/png,image/jpg"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Will be automatically converted to WebP
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="isVisible"
                    id="isVisible"
                    value="true"
                    defaultChecked={isDestTab ? editingDest?.isVisible : editingRegion?.isVisible}
                  />
                  <label htmlFor="isVisible" className="text-sm text-slate-700">
                    Visible on /plans page
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingDest(null);
                    setEditingRegion(null);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
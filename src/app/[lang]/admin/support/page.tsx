"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { motion, AnimatePresence } from "framer-motion";

interface SupportTicket {
  id: number;
  customerName: string | null;
  customerEmail: string;
  subject: string;
  message: string;
  status: string;
  adminReply: string | null;
  repliedAt: string | null;
  createdAt: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminSupportPage() {
  const { locale } = useI18n();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState("open");

  // Compose email state
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeMessage, setComposeMessage] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [composeStatus, setComposeStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.role === "admin") {
      fetchTickets();
    }
  }, [user, statusFilter]);

  async function fetchTickets() {
    try {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/admin/support${params}`, {
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.push("/");
          return;
        }
        throw new Error("Failed to fetch tickets");
      }

      const data = await res.json();
      setTickets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }

  async function sendReply() {
    if (!selectedTicket || !replyText.trim()) return;

    setSending(true);
    try {
      const res = await fetch("/api/admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reply",
          ticketId: selectedTicket.id,
          adminReply: replyText,
        }),
        credentials: "include",
      });

      if (res.ok) {
        await fetchTickets();
        setSelectedTicket(null);
        setReplyText("");
      } else {
        alert("Failed to send reply");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to send reply");
    } finally {
      setSending(false);
    }
  }

  async function sendComposeEmail(e: React.FormEvent) {
    e.preventDefault();

    if (!composeTo.trim() || !composeSubject.trim() || !composeMessage.trim()) {
      alert("Please fill in all fields");
      return;
    }

    setSendingEmail(true);
    setComposeStatus("idle");

    try {
      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: composeTo.trim(),
          subject: composeSubject.trim(),
          text: composeMessage.trim(),
        }),
        credentials: "include",
      });

      if (res.ok) {
        setComposeStatus("success");
        setComposeTo("");
        setComposeSubject("");
        setComposeMessage("");
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("Failed to send email:", err);
        setComposeStatus("error");
      }
    } catch (err) {
      console.error("Failed to send email:", err);
      setComposeStatus("error");
    } finally {
      setSendingEmail(false);
    }
  }
  if (authLoading || !user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/${locale}/admin`} className="text-xl font-bold text-slate-800">
              Admin Dashboard
            </Link>
            <span className="text-slate-400">/</span>
            <span className="text-sm text-slate-500">Support</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCompose(true)}
              className="bg-indigo-500 hover:bg-indigo-600 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-5 8v1a2 2 0 002 2h2a2 2 0 002-2v-1m-4-8l-4-4m0 0l-4 4m4-4v12" />
              </svg>
              Compose Email
            </button>
            <Link href={`/${locale}`} className="text-slate-500 hover:text-slate-700 text-sm">
              View Site
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Support Tickets</h1>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-orange-400"
          >
            <option value="">All Tickets</option>
            <option value="open">Open</option>
            <option value="replied">Replied</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">📭</p>
            <p className="text-slate-500">No support tickets</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {tickets.map((ticket) => (
              <motion.div
                key={ticket.id}
                className="bg-white rounded-xl border border-slate-200 p-6 cursor-pointer hover:border-orange-300 transition-colors"
                onClick={() => setSelectedTicket(ticket)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">{ticket.subject}</h3>
                    <p className="text-sm text-slate-500">
                      {ticket.customerName || ticket.customerEmail}
                    </p>
                  </div>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                    ticket.status === "open" ? "bg-blue-100 text-blue-700" :
                    ticket.status === "replied" ? "bg-green-100 text-green-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {ticket.status}
                  </span>
                </div>
                <p className="text-slate-600 line-clamp-2">{ticket.message}</p>
                <p className="text-xs text-slate-400 mt-3">{formatDate(ticket.createdAt)}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Ticket Detail Modal */}
      <AnimatePresence>
        {selectedTicket && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-800">{selectedTicket.subject}</h2>
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="text-slate-400 hover:text-slate-600 text-2xl"
                  >
                    ×
                  </button>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  {selectedTicket.customerName || selectedTicket.customerEmail}
                </p>
              </div>

              <div className="p-6">
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-1">Customer Message:</p>
                  <p className="text-slate-700 whitespace-pre-wrap">{selectedTicket.message}</p>
                </div>

                {selectedTicket.adminReply && (
                  <div className="mb-4 p-4 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Your Reply:</p>
                    <p className="text-slate-700 whitespace-pre-wrap">{selectedTicket.adminReply}</p>
                  </div>
                )}

                {!selectedTicket.adminReply && selectedTicket.status === "open" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Reply to Customer
                    </label>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply..."
                      rows={5}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-orange-400 resize-none"
                    />
                    <button
                      onClick={sendReply}
                      disabled={sending || !replyText.trim()}
                      className="mt-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
                    >
                      {sending ? "Sending..." : "Send Reply"}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compose Email Modal */}
      <AnimatePresence>
        {showCompose && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-800">Compose Email</h2>
                  <button
                    onClick={() => {
                      setShowCompose(false);
                      setComposeStatus("idle");
                    }}
                    className="text-slate-400 hover:text-slate-600 text-2xl"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="p-6">
                {composeStatus === "success" && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700"
                  >
                    Email sent successfully!
                  </motion.div>
                )}

                {composeStatus === "error" && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700"
                  >
                    Failed to send email. Please try again.
                  </motion.div>
                )}

                <form onSubmit={sendComposeEmail} className="space-y-4">
                  <div>
                    <label htmlFor="composeTo" className="block text-sm font-medium text-slate-700 mb-1">
                      To (Email Address)
                    </label>
                    <input
                      id="composeTo"
                      type="email"
                      value={composeTo}
                      onChange={(e) => setComposeTo(e.target.value)}
                      placeholder="customer@example.com"
                      required
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-orange-400 bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="composeSubject" className="block text-sm font-medium text-slate-700 mb-1">
                      Subject
                    </label>
                    <input
                      id="composeSubject"
                      type="text"
                      value={composeSubject}
                      onChange={(e) => setComposeSubject(e.target.value)}
                      placeholder="Enter email subject"
                      required
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-orange-400 bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="composeMessage" className="block text-sm font-medium text-slate-700 mb-1">
                      Message
                    </label>
                    <textarea
                      id="composeMessage"
                      value={composeMessage}
                      onChange={(e) => setComposeMessage(e.target.value)}
                      placeholder="Type your message here..."
                      rows={8}
                      required
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-orange-400 bg-white resize-none"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={sendingEmail}
                      className="bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white font-semibold px-6 py-3 rounded-xl transition-colors flex items-center gap-2"
                    >
                      {sendingEmail ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-5 8v1a2 2 0 002 2h2a2 2 0 002-2v-1m-4-8l-4-4m0 0l-4 4m4-4v12" />
                          </svg>
                          Send Email
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCompose(false);
                        setComposeStatus("idle");
                      }}
                      className="px-6 py-3 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

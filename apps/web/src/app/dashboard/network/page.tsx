"use client";
import useSWR from "swr";
import { useState, useRef, useEffect } from "react";
import { useApiSWRFetcher, useApiFetch } from "@/lib/apiFetch";
import { Search, UserPlus, Check, X, MessageCircle, Send, FileText, Mic, ChevronRight, Users, Share2, Clock } from "lucide-react";
import { format } from "date-fns";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 600, color: "white", flexShrink: 0 }}>
      {initials(name)}
    </div>
  );
}

const TABS = ["People", "Messages", "Shared"] as const;
type Tab = typeof TABS[number];

export default function NetworkPage() {
  const fetcher = useApiSWRFetcher();
  const apiFetch = useApiFetch();

  const [tab, setTab] = useState<Tab>("People");
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeChatUser, setActiveChatUser] = useState<any | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: connData, mutate: mutateConns } = useSWR(`${BASE}/api/network/connections`, fetcher);
  const connections: any[] = connData?.data ?? [];

  const accepted = connections.filter(c => c.status === "accepted");
  const pendingReceived = connections.filter(c => c.status === "pending" && c.direction === "received");
  const pendingSent = connections.filter(c => c.status === "pending" && c.direction === "sent");

  const { data: sharedData, mutate: mutateShared } = useSWR(`${BASE}/api/network/shared`, fetcher);
  const sharedItems: any[] = sharedData?.data ?? [];

  const { data: msgData, mutate: mutateMessages } = useSWR(
    activeChatUser ? `${BASE}/api/network/messages/${activeChatUser.id}` : null,
    fetcher,
    { refreshInterval: 3000 }
  );
  const messages: any[] = msgData?.data ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function searchUsers(q: string) {
    setSearchQ(q);
    if (q.length < 3) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await apiFetch(`/api/network/users/search?q=${encodeURIComponent(q)}`);
      setSearchResults(res.data);
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  }

  async function sendRequest(toUserId: string) {
    await apiFetch("/api/network/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId }),
    });
    mutateConns();
    setSearchResults([]);
    setSearchQ("");
  }

  async function respondToRequest(id: string, status: "accepted" | "rejected") {
    await apiFetch(`/api/network/connections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    mutateConns();
  }

  async function removeConnection(id: string) {
    await apiFetch(`/api/network/connections/${id}`, { method: "DELETE" });
    mutateConns();
    if (activeChatUser) setActiveChatUser(null);
  }

  async function sendMessage() {
    if (!activeChatUser || !messageText.trim()) return;
    setSending(true);
    try {
      await apiFetch("/api/network/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: activeChatUser.id, text: messageText.trim() }),
      });
      setMessageText("");
      mutateMessages();
    } finally { setSending(false); }
  }

  // Check if a user is already connected or pending
  function connectionStatus(userId: string) {
    const c = connections.find(c => c.user.id === userId);
    if (!c) return null;
    return c;
  }

  return (
    <div style={{ color: "white", maxWidth: 860, margin: "0 auto" }}>
      <div className="mb-6">
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 28 }}>
          My Network
        </h1>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 2 }}>
          Connect with classmates, share notes and recordings
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-[rgba(255,255,255,0.1)]">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t ? "text-white border-white" : "text-[rgba(255,255,255,0.4)] border-transparent hover:text-white"
            }`}>
            {t}
            {t === "People" && pendingReceived.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "#ef4444", color: "white" }}>
                {pendingReceived.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── PEOPLE ── */}
      {tab === "People" && (
        <div className="space-y-6">

          {/* Search & Add */}
          <div>
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>Add someone</p>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
              <input
                value={searchQ}
                onChange={e => searchUsers(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full rounded-xl pl-9 pr-4 py-3 text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
              />
            </div>

            {searchResults.length > 0 && (
              <div className="mt-2 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)" }}>
                {searchResults.map(u => {
                  const cs = connectionStatus(u.id);
                  return (
                    <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.06)] last:border-0">
                      <Avatar name={u.name} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{u.name}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{u.email}</div>
                      </div>
                      {cs ? (
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                          {cs.status === "accepted" ? "Connected" : "Pending"}
                        </span>
                      ) : (
                        <button onClick={() => sendRequest(u.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                          style={{ background: "white", color: "#111110" }}>
                          <UserPlus size={11} /> Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending requests */}
          {pendingReceived.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>Requests ({pendingReceived.length})</p>
              <div className="flex flex-col gap-2">
                {pendingReceived.map(c => (
                  <div key={c.id} className="flex items-center gap-3 rounded-2xl px-4 py-3 border" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}>
                    <Avatar name={c.user.name} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{c.user.name}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{c.user.email}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => respondToRequest(c.id, "accepted")}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium"
                        style={{ background: "white", color: "#111110" }}>
                        <Check size={11} /> Accept
                      </button>
                      <button onClick={() => respondToRequest(c.id, "rejected")}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs"
                        style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                        <X size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Connected */}
          <div>
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
              My Network ({accepted.length})
            </p>
            {accepted.length === 0 && pendingSent.length === 0 ? (
              <div className="rounded-2xl p-8 text-center border" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)", borderStyle: "dashed" }}>
                <Users size={28} style={{ color: "rgba(255,255,255,0.15)", margin: "0 auto 12px" }} />
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Search above to add your first connection</div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {accepted.map(c => (
                  <div key={c.id} className="flex items-center gap-3 rounded-2xl px-4 py-3 border transition-all hover:border-white/20" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)" }}>
                    <Avatar name={c.user.name} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{c.user.name}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{c.user.email}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setActiveChatUser(c.user); setTab("Messages"); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all"
                        style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}>
                        <MessageCircle size={11} /> Message
                      </button>
                      <button onClick={() => removeConnection(c.id)}
                        className="p-1.5 rounded-full transition-all opacity-30 hover:opacity-70"
                        style={{ color: "rgba(255,255,255,0.5)" }}>
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))}
                {pendingSent.map(c => (
                  <div key={c.id} className="flex items-center gap-3 rounded-2xl px-4 py-3 border" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.06)" }}>
                    <Avatar name={c.user.name} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>{c.user.name}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Request pending…</div>
                    </div>
                    <button onClick={() => removeConnection(c.id)} className="p-1.5 opacity-30 hover:opacity-70">
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MESSAGES ── */}
      {tab === "Messages" && (
        <div className="flex gap-4" style={{ height: "calc(100vh - 260px)", minHeight: 400 }}>

          {/* Sidebar — contacts */}
          <div className="w-56 shrink-0 flex flex-col gap-1 overflow-y-auto pr-1" style={{ scrollbarWidth: "none" }}>
            {accepted.length === 0 ? (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", padding: "16px 8px" }}>
                No connections yet — add people in the People tab.
              </div>
            ) : accepted.map(c => (
              <button key={c.id} onClick={() => setActiveChatUser(c.user)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                style={{
                  background: activeChatUser?.id === c.user.id ? "rgba(255,255,255,0.12)" : "transparent",
                  color: activeChatUser?.id === c.user.id ? "white" : "rgba(255,255,255,0.55)",
                }}>
                <Avatar name={c.user.name} size={30} />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{c.user.name}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Chat area */}
          <div className="flex-1 flex flex-col rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {!activeChatUser ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageCircle size={32} style={{ color: "rgba(255,255,255,0.12)", margin: "0 auto 12px" }} />
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>Select a connection to start chatting</div>
                </div>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.08)]">
                  <Avatar name={activeChatUser.name} size={30} />
                  <div>
                    <div className="text-sm font-medium">{activeChatUser.name}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{activeChatUser.email}</div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2" style={{ scrollbarWidth: "none" }}>
                  {messages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>No messages yet — say hello!</div>
                    </div>
                  ) : messages.map((m: any) => {
                    const isMe = m.toUserId === activeChatUser.id;
                    return (
                      <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className="max-w-[70%] rounded-2xl px-3 py-2 text-sm"
                          style={{
                            background: isMe ? "white" : "rgba(255,255,255,0.1)",
                            color: isMe ? "#111110" : "white",
                            borderBottomRightRadius: isMe ? 4 : undefined,
                            borderBottomLeftRadius: isMe ? undefined : 4,
                          }}>
                          {m.text}
                          <div style={{ fontSize: 9, marginTop: 4, opacity: 0.4, textAlign: isMe ? "right" : "left" }}>
                            {format(new Date(m.createdAt), "h:mm a")}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="px-4 py-3 border-t border-[rgba(255,255,255,0.08)] flex gap-2">
                  <input
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Type a message…"
                    className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                  />
                  <button onClick={sendMessage} disabled={sending || !messageText.trim()}
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                    style={{ background: messageText.trim() ? "white" : "rgba(255,255,255,0.1)", color: messageText.trim() ? "#111110" : "rgba(255,255,255,0.3)" }}>
                    <Send size={14} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── SHARED ── */}
      {tab === "Shared" && (
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>Shared with me</p>
          {sharedItems.length === 0 ? (
            <div className="rounded-2xl p-10 text-center border" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)", borderStyle: "dashed" }}>
              <Share2 size={28} style={{ color: "rgba(255,255,255,0.12)", margin: "0 auto 12px" }} />
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
                Nothing shared with you yet.<br />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Your connections can share recordings, notes, and more from the Workspace.</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sharedItems.map((item: any) => (
                <div key={item.id} className="flex items-start gap-4 rounded-2xl px-5 py-4 border" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)" }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.08)" }}>
                    {item.itemType === "lecture" ? <Mic size={15} style={{ color: "rgba(255,255,255,0.5)" }} /> : <FileText size={15} style={{ color: "rgba(255,255,255,0.5)" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium mb-0.5">{item.title}</div>
                    <div className="flex items-center gap-2" style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                      <span>Shared by {item.fromUser.name}</span>
                      <span>·</span>
                      <Clock size={9} />
                      <span>{format(new Date(item.createdAt), "MMM d")}</span>
                    </div>
                    {item.note && (
                      <div className="mt-2 text-xs rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)" }}>
                        "{item.note}"
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

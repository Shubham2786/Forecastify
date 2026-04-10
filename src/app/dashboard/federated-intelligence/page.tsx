"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Network, Users, Plus, LogIn, Copy, Check, ArrowLeft,
  Package, ShoppingCart, Tag, Store, Send, Loader2,
  CheckCircle2, Clock, X, Crown, MapPin, ChevronRight,
  Handshake, Search, DollarSign, BoxIcon,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

type View = "lobby" | "group";

export default function FederatedIntelligencePage() {
  const { user } = useAuth();
  const [view, setView] = useState<View>("lobby");
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  // ── Lobby state ────────────────────────────────────────────────────
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [discoverable, setDiscoverable] = useState<any[]>([]);
  const [storeName, setStoreName] = useState("");
  const [lobbyLoading, setLobbyLoading] = useState(true);

  // ── Create / Join modals ───────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  const [copied, setCopied] = useState(false);

  // ── Group detail state ─────────────────────────────────────────────
  const [groupData, setGroupData] = useState<any>(null);
  const [groupLoading, setGroupLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"requests" | "offers" | "members">("requests");

  // ── Post request/offer forms ───────────────────────────────────────
  const [showPostReq, setShowPostReq] = useState(false);
  const [showPostOffer, setShowPostOffer] = useState(false);
  const [postForm, setPostForm] = useState({ productName: "", category: "", quantity: "", unit: "pcs", price: "", message: "" });
  const [postLoading, setPostLoading] = useState(false);

  const api = useCallback(async (body: any) => {
    const res = await fetch("/api/federated-intelligence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, userId: user?.id }),
    });
    return res.json();
  }, [user]);

  // ── Load lobby ─────────────────────────────────────────────────────
  const loadLobby = useCallback(async () => {
    if (!user) return;
    setLobbyLoading(true);
    const data = await api({ action: "get_groups" });
    setMyGroups(data.myGroups || []);
    setDiscoverable(data.discoverable || []);
    setStoreName(data.storeName || "");
    setLobbyLoading(false);
  }, [user, api]);

  useEffect(() => { loadLobby(); }, [loadLobby]);

  // ── Create group ───────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!createName.trim()) return;
    setFormLoading(true);
    setFormError("");
    const data = await api({ action: "create_group", groupName: createName.trim() });
    setFormLoading(false);
    if (data.error) { setFormError(data.error); return; }
    setCreatedCode(data.inviteCode);
    loadLobby();
  };

  // ── Join group ─────────────────────────────────────────────────────
  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setFormLoading(true);
    setFormError("");
    const data = await api({ action: "join_group", inviteCode: joinCode.trim() });
    setFormLoading(false);
    if (data.error) { setFormError(data.error); return; }
    setShowJoin(false);
    setJoinCode("");
    loadLobby();
  };

  // ── Open group detail ──────────────────────────────────────────────
  const openGroup = async (groupId: string) => {
    setActiveGroupId(groupId);
    setView("group");
    setGroupLoading(true);
    const data = await api({ action: "get_group_detail", groupId });
    setGroupData(data);
    setGroupLoading(false);
  };

  const refreshGroup = () => { if (activeGroupId) openGroup(activeGroupId); };

  // ── Leave group ────────────────────────────────────────────────────
  const leaveGroup = async () => {
    if (!activeGroupId) return;
    await api({ action: "leave_group", groupId: activeGroupId });
    setView("lobby");
    setActiveGroupId(null);
    loadLobby();
  };

  // ── Post request / offer ───────────────────────────────────────────
  const submitPost = async (type: "request" | "offer") => {
    if (!postForm.productName.trim() || !postForm.quantity) return;
    setPostLoading(true);
    if (type === "request") {
      await api({
        action: "post_request",
        groupId: activeGroupId,
        productName: postForm.productName.trim(),
        category: postForm.category || null,
        quantity: Number(postForm.quantity),
        unit: postForm.unit,
        message: postForm.message || null,
      });
    } else {
      await api({
        action: "post_offer",
        groupId: activeGroupId,
        productName: postForm.productName.trim(),
        category: postForm.category || null,
        quantity: Number(postForm.quantity),
        unit: postForm.unit,
        price: Number(postForm.price) || 0,
        message: postForm.message || null,
      });
    }
    setPostLoading(false);
    setShowPostReq(false);
    setShowPostOffer(false);
    setPostForm({ productName: "", category: "", quantity: "", unit: "pcs", price: "", message: "" });
    refreshGroup();
  };

  // ── Fulfill / Claim ────────────────────────────────────────────────
  const fulfillRequest = async (requestId: string) => {
    await api({ action: "fulfill_request", requestId });
    refreshGroup();
  };

  const claimOffer = async (offerId: string) => {
    await api({ action: "claim_offer", offerId });
    refreshGroup();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const inputCls = "w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm";

  // ═══════════════════════════════════════════════════════════════════
  // ── LOBBY VIEW ─────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════
  if (view === "lobby") {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="bg-linear-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 border border-indigo-500/15 rounded-2xl p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Network className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Peer Intelligence Network</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Connect with similar stores, share stock, and help each other
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setShowJoin(true); setFormError(""); setJoinCode(""); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary border border-border text-sm font-medium text-foreground hover:bg-secondary/80 transition-all">
                <LogIn className="w-4 h-4" /> Join Group
              </button>
              <button onClick={() => { setShowCreate(true); setFormError(""); setCreateName(""); setCreatedCode(""); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20">
                <Plus className="w-4 h-4" /> Create Group
              </button>
            </div>
          </div>
        </div>

        {lobbyLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* My Groups */}
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-indigo-500" /> My Groups
                {myGroups.length > 0 && <span className="text-xs text-muted-foreground font-normal ml-1">({myGroups.length})</span>}
              </h3>

              {myGroups.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-8 text-center">
                  <Network className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">You haven&apos;t joined any group yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Create a new group or join with an invite code</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myGroups.map((g) => (
                    <button key={g.id} onClick={() => openGroup(g.id)}
                      className="bg-card border border-border rounded-xl p-4 text-left hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                            <Store className="w-4 h-4 text-indigo-500" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-foreground">{g.name}</h4>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-2.5 h-2.5" /> {g.city || g.state || "India"} • {g.category}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-indigo-500 transition-colors" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-2 bg-secondary/50 rounded-lg">
                          <p className="text-sm font-bold text-foreground">{g.memberCount}</p>
                          <p className="text-[10px] text-muted-foreground">Stores</p>
                        </div>
                        <div className="text-center p-2 bg-secondary/50 rounded-lg">
                          <p className="text-sm font-bold text-amber-500">{g.openRequests}</p>
                          <p className="text-[10px] text-muted-foreground">Requests</p>
                        </div>
                        <div className="text-center p-2 bg-secondary/50 rounded-lg">
                          <p className="text-sm font-bold text-green-500">{g.openOffers}</p>
                          <p className="text-[10px] text-muted-foreground">Offers</p>
                        </div>
                      </div>
                      {g.isOwner && (
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-500">
                          <Crown className="w-3 h-3" /> You created this group
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Discoverable Groups */}
            {discoverable.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <Search className="w-4 h-4 text-purple-500" /> Discover Groups in Your Category
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {discoverable.map((g) => (
                    <div key={g.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">{g.name}</h4>
                        <p className="text-[10px] text-muted-foreground">{g.city || g.state} • {g.category}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Ask owner for invite code</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Create Group Modal ────────────────────────────────────── */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Plus className="w-5 h-5 text-indigo-500" /> Create Group
                </h2>
                <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
              </div>

              {createdCode ? (
                <div className="text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7 text-green-500" />
                  </div>
                  <p className="text-sm text-foreground font-semibold">Group Created!</p>
                  <p className="text-xs text-muted-foreground">Share this invite code with other store owners</p>
                  <div className="flex items-center justify-center gap-2">
                    <div className="px-6 py-3 bg-secondary rounded-xl text-2xl font-mono font-bold tracking-[0.3em] text-foreground">
                      {createdCode}
                    </div>
                    <button onClick={() => copyCode(createdCode)} className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                      {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                  <button onClick={() => { setShowCreate(false); setCreatedCode(""); }}
                    className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all">
                    Done
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Group Name</label>
                    <input value={createName} onChange={(e) => setCreateName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                      placeholder="e.g. Pune Grocery Network" className={inputCls} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your store category (<strong>{storeName}</strong>) and city will be auto-tagged. An invite code will be generated to share with other stores.
                  </p>
                  {formError && <p className="text-xs text-red-500">{formError}</p>}
                  <button onClick={handleCreate} disabled={formLoading || !createName.trim()}
                    className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Create Group
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Join Group Modal ──────────────────────────────────────── */}
        {showJoin && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => setShowJoin(false)}>
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <LogIn className="w-5 h-5 text-indigo-500" /> Join Group
                </h2>
                <button onClick={() => setShowJoin(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Invite Code</label>
                  <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                    placeholder="e.g. ABC123" maxLength={6}
                    className={`${inputCls} text-center text-xl font-mono tracking-[0.3em] uppercase`} />
                </div>
                <p className="text-xs text-muted-foreground">Enter the 6-character code shared by the group owner</p>
                {formError && <p className="text-xs text-red-500">{formError}</p>}
                <button onClick={handleJoin} disabled={formLoading || joinCode.trim().length < 4}
                  className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  Join Group
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // ── GROUP DETAIL VIEW ──────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════
  if (groupLoading || !groupData) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const group = groupData.group;
  const members = groupData.members || [];
  const requests = groupData.requests || [];
  const offers = groupData.offers || [];

  const openRequests = requests.filter((r: any) => r.status === "open");
  const openOffers = offers.filter((o: any) => o.status === "available");

  return (
    <div className="space-y-5">
      {/* Group Header */}
      <div className="bg-linear-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 border border-indigo-500/15 rounded-2xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => { setView("lobby"); setActiveGroupId(null); loadLobby(); }}
              className="p-2 rounded-lg bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <Store className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{group.name}</h2>
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {group.city || group.state}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> {group.category}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {members.length} stores</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary rounded-lg">
              <span className="text-xs text-muted-foreground">Code:</span>
              <span className="text-sm font-mono font-bold text-foreground tracking-wider">{group.invite_code}</span>
              <button onClick={() => copyCode(group.invite_code)} className="p-1 rounded hover:bg-card transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
            </div>
            <button onClick={leaveGroup} className="px-3 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-500/10 transition-colors">
              Leave
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1">
        {[
          { key: "requests" as const, label: "Requests", count: openRequests.length, icon: ShoppingCart, color: "text-amber-500" },
          { key: "offers" as const, label: "Offers", count: openOffers.length, icon: Package, color: "text-green-500" },
          { key: "members" as const, label: "Members", count: members.length, icon: Users, color: "text-indigo-500" },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className={`w-4 h-4 ${activeTab === tab.key ? tab.color : ""}`} />
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === tab.key ? "bg-indigo-500 text-white" : "bg-secondary text-muted-foreground"
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Requests Tab ───────────────────────────────────────────── */}
      {activeTab === "requests" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{openRequests.length} open requests from stores needing products</p>
            <button onClick={() => { setShowPostReq(true); setPostForm({ productName: "", category: "", quantity: "", unit: "pcs", price: "", message: "" }); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-all">
              <Plus className="w-3.5 h-3.5" /> Request Product
            </button>
          </div>

          {requests.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <ShoppingCart className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No requests yet. Need a product? Post a request!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map((r: any) => {
                const isOpen = r.status === "open";
                const isMine = r.requester_id === user?.id;
                return (
                  <div key={r.id} className={`bg-card border rounded-xl p-4 ${isOpen ? "border-amber-500/20" : "border-border opacity-60"}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isOpen ? "bg-amber-500/10" : "bg-green-500/10"}`}>
                          {isOpen ? <ShoppingCart className="w-5 h-5 text-amber-500" /> : <CheckCircle2 className="w-5 h-5 text-green-500" />}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-foreground">{r.product_name}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            <span className="font-medium">{r.requester_store}</span> needs <strong>{r.quantity_needed} {r.unit}</strong>
                            {r.category && <span> • {r.category}</span>}
                          </p>
                          {r.message && <p className="text-xs text-muted-foreground mt-1 italic">&quot;{r.message}&quot;</p>}
                          <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" /> {new Date(r.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 ml-3">
                        {isOpen && !isMine ? (
                          <button onClick={() => fulfillRequest(r.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-all">
                            <Handshake className="w-3.5 h-3.5" /> I Can Supply
                          </button>
                        ) : isOpen && isMine ? (
                          <span className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold">YOUR REQUEST</span>
                        ) : (
                          <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-500 text-[10px] font-bold">Fulfilled by {r.fulfiller_store}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Offers Tab ─────────────────────────────────────────────── */}
      {activeTab === "offers" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{openOffers.length} products available from peer stores</p>
            <button onClick={() => { setShowPostOffer(true); setPostForm({ productName: "", category: "", quantity: "", unit: "pcs", price: "", message: "" }); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-all">
              <Plus className="w-3.5 h-3.5" /> Offer Product
            </button>
          </div>

          {offers.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <Package className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No offers yet. Have excess stock? Post an offer!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {offers.map((o: any) => {
                const isAvailable = o.status === "available";
                const isMine = o.offerer_id === user?.id;
                return (
                  <div key={o.id} className={`bg-card border rounded-xl p-4 ${isAvailable ? "border-green-500/20" : "border-border opacity-60"}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <BoxIcon className="w-4 h-4 text-green-500" /> {o.product_name}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          from <strong>{o.offerer_store}</strong>
                          {o.category && <span> • {o.category}</span>}
                        </p>
                      </div>
                      {!isAvailable && (
                        <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold">Claimed by {o.claimer_store}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mb-2">
                      <div className="flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm font-bold text-foreground">{o.quantity_available} {o.unit}</span>
                      </div>
                      {o.price > 0 && (
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-bold text-foreground">₹{o.price}/{o.unit}</span>
                        </div>
                      )}
                    </div>
                    {o.message && <p className="text-xs text-muted-foreground italic mb-2">&quot;{o.message}&quot;</p>}
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> {new Date(o.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                      {isAvailable && !isMine && (
                        <button onClick={() => claimOffer(o.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all">
                          <ShoppingCart className="w-3.5 h-3.5" /> Claim
                        </button>
                      )}
                      {isMine && isAvailable && (
                        <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-500 text-[10px] font-bold">YOUR OFFER</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Members Tab ────────────────────────────────────────────── */}
      {activeTab === "members" && (
        <div className="space-y-2">
          {members.map((m: any) => (
            <div key={m.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-sm font-bold text-indigo-500">
                  {m.store_name?.charAt(0)?.toUpperCase() || "S"}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    {m.store_name}
                    {m.store_id === group.created_by && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                  </h4>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5" /> {m.city || "India"}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">Joined {new Date(m.joined_at).toLocaleDateString("en-IN")}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Post Request Modal ─────────────────────────────────────── */}
      {showPostReq && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => setShowPostReq(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-amber-500" /> Request a Product
              </h2>
              <button onClick={() => setShowPostReq(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Product Name *</label>
                <input value={postForm.productName} onChange={(e) => setPostForm({ ...postForm, productName: e.target.value })}
                  placeholder="e.g. Amul Butter 100g" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Quantity *</label>
                  <input type="number" min="1" value={postForm.quantity} onChange={(e) => setPostForm({ ...postForm, quantity: e.target.value })}
                    placeholder="e.g. 50" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Unit</label>
                  <select value={postForm.unit} onChange={(e) => setPostForm({ ...postForm, unit: e.target.value })} className={inputCls}>
                    {["pcs", "kg", "g", "L", "ml", "box", "pack", "dozen"].map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                <input value={postForm.category} onChange={(e) => setPostForm({ ...postForm, category: e.target.value })}
                  placeholder="e.g. Dairy" className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Message (optional)</label>
                <input value={postForm.message} onChange={(e) => setPostForm({ ...postForm, message: e.target.value })}
                  placeholder="e.g. Need urgently by tomorrow" className={inputCls} />
              </div>
              <button onClick={() => submitPost("request")} disabled={postLoading || !postForm.productName.trim() || !postForm.quantity}
                className="w-full py-2.5 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {postLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Post Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Post Offer Modal ───────────────────────────────────────── */}
      {showPostOffer && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => setShowPostOffer(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Package className="w-5 h-5 text-green-500" /> Offer a Product
              </h2>
              <button onClick={() => setShowPostOffer(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Product Name *</label>
                <input value={postForm.productName} onChange={(e) => setPostForm({ ...postForm, productName: e.target.value })}
                  placeholder="e.g. Tata Salt 1kg" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Quantity *</label>
                  <input type="number" min="1" value={postForm.quantity} onChange={(e) => setPostForm({ ...postForm, quantity: e.target.value })}
                    placeholder="e.g. 30" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Unit</label>
                  <select value={postForm.unit} onChange={(e) => setPostForm({ ...postForm, unit: e.target.value })} className={inputCls}>
                    {["pcs", "kg", "g", "L", "ml", "box", "pack", "dozen"].map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Price per unit (₹)</label>
                  <input type="number" min="0" step="0.5" value={postForm.price} onChange={(e) => setPostForm({ ...postForm, price: e.target.value })}
                    placeholder="e.g. 25" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                  <input value={postForm.category} onChange={(e) => setPostForm({ ...postForm, category: e.target.value })}
                    placeholder="e.g. Groceries" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Message (optional)</label>
                <input value={postForm.message} onChange={(e) => setPostForm({ ...postForm, message: e.target.value })}
                  placeholder="e.g. Expiring in 15 days, selling at discount" className={inputCls} />
              </div>
              <button onClick={() => submitPost("offer")} disabled={postLoading || !postForm.productName.trim() || !postForm.quantity}
                className="w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {postLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Post Offer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

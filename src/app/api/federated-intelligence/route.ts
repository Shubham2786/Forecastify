import { createClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/*
  ── Required Supabase Tables ──────────────────────────────────────────
  Run this SQL in Supabase Dashboard → SQL Editor:

  CREATE TABLE IF NOT EXISTS store_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    city TEXT,
    state TEXT,
    invite_code TEXT UNIQUE NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS group_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES store_groups(id) ON DELETE CASCADE,
    store_id UUID NOT NULL,
    store_name TEXT NOT NULL,
    city TEXT,
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(group_id, store_id)
  );

  CREATE TABLE IF NOT EXISTS product_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES store_groups(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL,
    requester_store TEXT NOT NULL,
    product_name TEXT NOT NULL,
    category TEXT,
    quantity_needed INT NOT NULL,
    unit TEXT DEFAULT 'pcs',
    message TEXT,
    status TEXT DEFAULT 'open',
    fulfilled_by UUID,
    fulfiller_store TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS product_offers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES store_groups(id) ON DELETE CASCADE,
    offerer_id UUID NOT NULL,
    offerer_store TEXT NOT NULL,
    product_name TEXT NOT NULL,
    category TEXT,
    quantity_available INT NOT NULL,
    unit TEXT DEFAULT 'pcs',
    price FLOAT DEFAULT 0,
    message TEXT,
    status TEXT DEFAULT 'available',
    claimed_by UUID,
    claimer_store TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );
*/

// Generate a short invite code
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, userId } = body;

    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("store_name, store_category, city, state")
      .eq("id", userId)
      .single();

    const storeName = profile?.store_name || "My Store";

    switch (action) {
      // ── CREATE GROUP ────────────────────────────────────────────
      case "create_group": {
        const { groupName } = body;
        if (!groupName) return Response.json({ error: "groupName required" }, { status: 400 });

        const inviteCode = generateInviteCode();

        const { data: group, error: gErr } = await supabase
          .from("store_groups")
          .insert({
            name: groupName,
            category: profile?.store_category || "Retail",
            city: profile?.city,
            state: profile?.state,
            invite_code: inviteCode,
            created_by: userId,
          })
          .select()
          .single();

        if (gErr) return Response.json({ error: gErr.message }, { status: 500 });

        // Auto-join the creator
        await supabase.from("group_members").insert({
          group_id: group.id,
          store_id: userId,
          store_name: storeName,
          city: profile?.city,
        });

        return Response.json({ group, inviteCode });
      }

      // ── JOIN GROUP ──────────────────────────────────────────────
      case "join_group": {
        const { inviteCode } = body;
        if (!inviteCode) return Response.json({ error: "inviteCode required" }, { status: 400 });

        const { data: group } = await supabase
          .from("store_groups")
          .select("*")
          .eq("invite_code", inviteCode.toUpperCase().trim())
          .single();

        if (!group) return Response.json({ error: "Invalid invite code. Check and try again." }, { status: 404 });

        // Check if already a member
        const { data: existing } = await supabase
          .from("group_members")
          .select("id")
          .eq("group_id", group.id)
          .eq("store_id", userId)
          .single();

        if (existing) return Response.json({ error: "You are already in this group" }, { status: 400 });

        await supabase.from("group_members").insert({
          group_id: group.id,
          store_id: userId,
          store_name: storeName,
          city: profile?.city,
        });

        return Response.json({ group, joined: true });
      }

      // ── LEAVE GROUP ─────────────────────────────────────────────
      case "leave_group": {
        const { groupId } = body;
        await supabase
          .from("group_members")
          .delete()
          .eq("group_id", groupId)
          .eq("store_id", userId);

        return Response.json({ left: true });
      }

      // ── GET MY GROUPS ───────────────────────────────────────────
      case "get_groups": {
        const { data: memberships } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("store_id", userId);

        const groupIds = memberships?.map((m) => m.group_id) || [];

        if (groupIds.length === 0) {
          // Also show discoverable groups of same category
          const { data: discoverable } = await supabase
            .from("store_groups")
            .select("*")
            .eq("category", profile?.store_category || "Retail")
            .order("created_at", { ascending: false })
            .limit(10);

          return Response.json({ myGroups: [], discoverable: discoverable || [], storeName });
        }

        const { data: groups } = await supabase
          .from("store_groups")
          .select("*")
          .in("id", groupIds)
          .order("created_at", { ascending: false });

        // Get member counts
        const enriched = await Promise.all(
          (groups || []).map(async (g) => {
            const { count } = await supabase
              .from("group_members")
              .select("*", { count: "exact", head: true })
              .eq("group_id", g.id);

            const { count: openRequests } = await supabase
              .from("product_requests")
              .select("*", { count: "exact", head: true })
              .eq("group_id", g.id)
              .eq("status", "open");

            const { count: openOffers } = await supabase
              .from("product_offers")
              .select("*", { count: "exact", head: true })
              .eq("group_id", g.id)
              .eq("status", "available");

            return { ...g, memberCount: count || 0, openRequests: openRequests || 0, openOffers: openOffers || 0, isOwner: g.created_by === userId };
          })
        );

        // Discoverable groups (same category, not already joined)
        const { data: discoverable } = await supabase
          .from("store_groups")
          .select("*")
          .eq("category", profile?.store_category || "Retail")
          .not("id", "in", `(${groupIds.join(",")})`)
          .order("created_at", { ascending: false })
          .limit(10);

        return Response.json({ myGroups: enriched, discoverable: discoverable || [], storeName });
      }

      // ── GET GROUP DETAIL ────────────────────────────────────────
      case "get_group_detail": {
        const { groupId } = body;

        const { data: group } = await supabase
          .from("store_groups")
          .select("*")
          .eq("id", groupId)
          .single();

        if (!group) return Response.json({ error: "Group not found" }, { status: 404 });

        const { data: members } = await supabase
          .from("group_members")
          .select("*")
          .eq("group_id", groupId)
          .order("joined_at", { ascending: true });

        const { data: requests } = await supabase
          .from("product_requests")
          .select("*")
          .eq("group_id", groupId)
          .order("created_at", { ascending: false })
          .limit(30);

        const { data: offers } = await supabase
          .from("product_offers")
          .select("*")
          .eq("group_id", groupId)
          .order("created_at", { ascending: false })
          .limit(30);

        return Response.json({
          group,
          members: members || [],
          requests: requests || [],
          offers: offers || [],
          isOwner: group.created_by === userId,
          storeName,
        });
      }

      // ── POST REQUEST (need a product) ───────────────────────────
      case "post_request": {
        const { groupId, productName, category, quantity, unit, message } = body;

        const { data: req, error } = await supabase
          .from("product_requests")
          .insert({
            group_id: groupId,
            requester_id: userId,
            requester_store: storeName,
            product_name: productName,
            category: category || null,
            quantity_needed: quantity,
            unit: unit || "pcs",
            message: message || null,
          })
          .select()
          .single();

        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ request: req });
      }

      // ── FULFILL REQUEST ─────────────────────────────────────────
      case "fulfill_request": {
        const { requestId } = body;

        const { error } = await supabase
          .from("product_requests")
          .update({ status: "fulfilled", fulfilled_by: userId, fulfiller_store: storeName })
          .eq("id", requestId)
          .eq("status", "open");

        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ fulfilled: true });
      }

      // ── POST OFFER (sell/share a product) ───────────────────────
      case "post_offer": {
        const { groupId, productName, category, quantity, unit, price, message } = body;

        const { data: offer, error } = await supabase
          .from("product_offers")
          .insert({
            group_id: groupId,
            offerer_id: userId,
            offerer_store: storeName,
            product_name: productName,
            category: category || null,
            quantity_available: quantity,
            unit: unit || "pcs",
            price: price || 0,
            message: message || null,
          })
          .select()
          .single();

        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ offer });
      }

      // ── CLAIM OFFER ─────────────────────────────────────────────
      case "claim_offer": {
        const { offerId } = body;

        const { error } = await supabase
          .from("product_offers")
          .update({ status: "claimed", claimed_by: userId, claimer_store: storeName })
          .eq("id", offerId)
          .eq("status", "available");

        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ claimed: true });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error("Federated Intelligence error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

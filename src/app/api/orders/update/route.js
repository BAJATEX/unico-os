// src/app/api/orders/update/route.js
import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/serverSupabase";

function json(status, body) {
  return NextResponse.json(body, { status });
}

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const body = await req.json();
    const { org_id, requester_user_id, order_id, patch } = body || {};

    if (!org_id || !requester_user_id || !order_id || !patch) {
      return json(400, { error: "Missing org_id/requester_user_id/order_id/patch" });
    }

    // Check membership role
    const { data: mem, error: memErr } = await sb
      .from("org_memberships")
      .select("role")
      .eq("org_id", org_id)
      .eq("user_id", requester_user_id)
      .maybeSingle();

    if (memErr) return json(500, { error: memErr.message });

    const r = (mem?.role || "viewer").toLowerCase();
    const canWrite = ["owner", "admin", "ops", "sales"].includes(r);
    if (!canWrite) return json(403, { error: "Not allowed" });

    const { data, error } = await sb
      .from("orders")
      .update(patch)
      .eq("org_id", org_id)
      .eq("id", order_id)
      .select("*")
      .single();

    if (error) return json(500, { error: error.message });

    return json(200, { ok: true, order: data });
  } catch (e) {
    return json(500, { error: e?.message || "Server error" });
  }
}
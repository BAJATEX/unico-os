// src/app/api/stripe/summary/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, requireUserFromToken } from "@/lib/serverSupabase";

const json = (status, payload) => NextResponse.json(payload, { status });

function getBearerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

const isUuid = (s) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || "").trim());

const normEmail = (s) => String(s || "").trim().toLowerCase();

async function getMyRole(sb, orgId, user) {
  const myEmail = normEmail(user?.email);
  const uid = user?.id || "00000000-0000-0000-0000-000000000000";

  // org_id first
  const q1 = await sb
    .from("admin_users")
    .select("role,is_active")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .or(`user_id.eq.${uid},email.ilike.${myEmail}`)
    .limit(1)
    .maybeSingle();

  if (!q1?.error && q1?.data?.is_active) return String(q1.data.role || "").toLowerCase();

  // fallback organization_id
  const q2 = await sb
    .from("admin_users")
    .select("role,is_active")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .or(`user_id.eq.${uid},email.ilike.${myEmail}`)
    .limit(1)
    .maybeSingle();

  if (!q2?.error && q2?.data?.is_active) return String(q2.data.role || "").toLowerCase();

  return null;
}

async function stripeGet(path, params = {}) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Falta STRIPE_SECRET_KEY");

  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    qs.set(k, String(v));
  });

  const url = `https://api.stripe.com${path}${qs.toString() ? `?${qs.toString()}` : ""}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${key}`,
    },
  });

  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(j?.error?.message || `Stripe error (${res.status})`);
  return j;
}

const centsToMXN = (cents) => (Number(cents || 0) / 100);

export async function POST(req) {
  try {
    const sb = serverSupabase();
    const token = getBearerToken(req);
    const { user, error: authErr } = await requireUserFromToken(sb, token);
    if (authErr) return json(401, { ok: false, error: "No autorizado" });

    const body = await req.json().catch(() => ({}));
    const orgId = String(body?.org_id || "").trim();
    if (!isUuid(orgId)) return json(400, { ok: false, error: "org_id inválido" });

    const role = await getMyRole(sb, orgId, user);
    if (!role || !["owner", "admin", "finance"].includes(role)) {
      return json(403, { ok: false, error: "Permisos insuficientes" });
    }

    // 30 días atrás
    const now = Math.floor(Date.now() / 1000);
    const since = now - 60 * 60 * 24 * 30;

    // Balance (lo más parecido al dashboard)
    const balance = await stripeGet("/v1/balance");

    // Últimos payouts
    const payouts = await stripeGet("/v1/payouts", { limit: 10 });

    // Disputes y Refunds recientes
    const disputes = await stripeGet("/v1/disputes", { limit: 10, "created[gte]": since });
    const refunds = await stripeGet("/v1/refunds", { limit: 10, "created[gte]": since });

    const sum = (arr, field) => (arr || []).reduce((a, x) => a + Number(x?.[field] || 0), 0);

    const availableMXN = centsToMXN(sum(balance?.available || [], "amount"));
    const pendingMXN = centsToMXN(sum(balance?.pending || [], "amount"));

    const lastPayouts = (payouts?.data || []).map((p) => ({
      id: p.id,
      amount_mxn: centsToMXN(p.amount),
      status: p.status,
      arrival_date: p.arrival_date ? new Date(p.arrival_date * 1000).toISOString() : null,
      created: p.created ? new Date(p.created * 1000).toISOString() : null,
    }));

    const disputesCount = (disputes?.data || []).length;
    const disputesAmountMXN = centsToMXN(sum(disputes?.data || [], "amount"));

    const refundsCount = (refunds?.data || []).length;
    const refundsAmountMXN = centsToMXN(sum(refunds?.data || [], "amount"));

    return json(200, {
      ok: true,
      balance: {
        available_mxn: availableMXN,
        pending_mxn: pendingMXN,
      },
      payouts: lastPayouts,
      last_30_days: {
        disputes_count: disputesCount,
        disputes_amount_mxn: disputesAmountMXN,
        refunds_count: refundsCount,
        refunds_amount_mxn: refundsAmountMXN,
      },
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}
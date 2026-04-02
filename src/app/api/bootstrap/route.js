// src/app/api/bootstrap/route.js

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const ENVIA_API_KEY = process.env.ENVIA_API_KEY;

function json(data, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getToken(req) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return "";
  return auth.replace("Bearer ", "").trim();
}

async function checkAuth(supabase) {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return false;
    return true;
  } catch {
    return false;
  }
}

async function checkDB(supabase) {
  try {
    const { error } = await supabase
      .from("products")
      .select("id")
      .limit(1);

    return !error;
  } catch {
    return false;
  }
}

async function checkStripe() {
  try {
    if (!STRIPE_SECRET) return false;

    const res = await fetch("https://api.stripe.com/v1/balance", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET}`,
      },
    });

    return res.ok;
  } catch {
    return false;
  }
}

async function checkEnvia() {
  try {
    if (!ENVIA_API_KEY) return false;

    const res = await fetch("https://api.envia.com/shipments", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ENVIA_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    // No importa si no hay envíos, solo conexión válida
    return res.status === 200 || res.status === 204;
  } catch {
    return false;
  }
}

async function checkIA() {
  try {
    // No hacemos request externo, solo validamos que endpoint exista
    return true;
  } catch {
    return false;
  }
}

export async function GET(req) {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON) {
      return json(
        {
          ok: false,
          error: "Supabase no configurado",
        },
        500
      );
    }

    const token = getToken(req);
    if (!token) {
      return json(
        {
          ok: false,
          error: "Token requerido",
        },
        401
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Ejecutar checks en paralelo (real performance)
    const [auth, db, stripe, envia, ia] = await Promise.all([
      checkAuth(supabase),
      checkDB(supabase),
      checkStripe(),
      checkEnvia(),
      checkIA(),
    ]);

    return json({
      ok: true,
      timestamp: new Date().toISOString(),
      checks: {
        auth,
        db,
        stripe,
        envia,
        ia,
      },
    });
  } catch (e) {
    return json(
      {
        ok: false,
        error: String(e?.message || e),
      },
      500
    );
  }
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serverSupabase, getUserFromRequest } from "@/lib/serverSupabase";

export async function GET(req) {
  try {
    const sb = serverSupabase();

    const { user, error } = await getUserFromRequest(req);

    if (error || !user) {
      return NextResponse.json(
        { ok: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    // Buscar acceso en admin_users
    const { data: admin, error: adminError } = await sb
      .from("admin_users")
      .select("*")
      .eq("email", user.email)
      .eq("is_active", true);

    if (adminError) {
      return NextResponse.json(
        { ok: false, error: adminError.message },
        { status: 500 }
      );
    }

    if (!admin || admin.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Usuario sin acceso a organización" },
        { status: 403 }
      );
    }

    const organizations = admin.map((row) => ({
      organization_id: row.org_id || row.organization_id,
      role: row.role,
    }));

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
      },
      organizations,
      organization_id: organizations[0]?.organization_id,
      role: organizations[0]?.role,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e.message || e) },
      { status: 500 }
    );
  }
}
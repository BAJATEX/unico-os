"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

const STORAGE_ORG = "unicos.org_id";

function safeStr(v, d = "") {
  return typeof v === "string" ? v : v == null ? d : String(v);
}

async function fetchWho(accessToken) {
  const res = await fetch("/api/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || "No se pudo resolver tu organización.");
  }

  return data;
}

function syncOrgToStorage(orgId) {
  if (typeof window === "undefined") return;
  if (!orgId) return;

  try {
    window.localStorage.setItem(STORAGE_ORG, orgId);
  } catch {}
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Validando tu acceso...");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        setBusy(true);

        if (!supabase) {
          throw new Error("La conexión de autenticación no está disponible.");
        }

        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type") || "magiclink";
        const orgFromQuery = safeStr(
          url.searchParams.get("org_id") ||
            url.searchParams.get("orgId") ||
            url.searchParams.get("organization_id") ||
            ""
        ).trim();

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
          });
          if (error) throw error;
        }

        const {
          data: { session },
          error: sessionErr,
        } = await supabase.auth.getSession();

        if (sessionErr) throw sessionErr;

        const accessToken = session?.access_token || "";
        if (!accessToken) {
          throw new Error("No se pudo recuperar la sesión.");
        }

        const who = await fetchWho(accessToken);
        const orgId =
          orgFromQuery ||
          safeStr(who?.organization_id || who?.default_organization_id || "");

        if (orgId) syncOrgToStorage(orgId);

        if (!active) return;

        setMessage("Acceso confirmado. Entrando al panel...");
        router.replace("/");
      } catch (e) {
        if (!active) return;
        setMessage(
          String(e?.message || "No pude validar tu acceso. Pide un nuevo enlace.")
        );
      } finally {
        if (active) setBusy(false);
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 unicos-shell">
      <div className="unicos-wrap w-full max-w-xl">
        <section className="unicos-panel p-8 md:p-10 text-center animate-unicos-slide-up">
          <div className="mx-auto mb-5 h-20 w-20 unicos-brand-frame p-3">
            <Image
              src="/logo-unico.png"
              alt="UnicOs"
              width={80}
              height={80}
              className="h-full w-full object-contain rounded-[20px]"
              priority
            />
          </div>

          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-300">
            Acceso seguro
          </p>

          <h1 className="mt-3 text-3xl font-black text-white">
            Estamos abriendo tu panel
          </h1>

          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            {message}
          </p>

          {busy ? (
            <div className="mt-6 flex items-center justify-center gap-3 text-slate-400">
              <span className="h-3 w-3 rounded-full bg-sky-400 animate-pulse" />
              <span className="text-sm font-bold">
                Sincronizando sesión y organización...
              </span>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
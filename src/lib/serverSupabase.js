// src/lib/serverSupabase.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "";

const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  "";

let cachedClient = null;

function safeStr(v, d = "") {
  return typeof v === "string" ? v : v == null ? d : String(v);
}

function buildConfigError() {
  const missing = [];
  if (!SUPABASE_URL) {
    missing.push("SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL)");
  }
  if (!SUPABASE_SERVICE_KEY) {
    missing.push("SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY)");
  }

  return new Error(
    `Supabase server no configurado: falta ${missing.join(" y ")}.`
  );
}

function makeDisabledQueryBuilder() {
  const fail = async () => {
    throw buildConfigError();
  };

  const builder = new Proxy(
    {},
    {
      get(_target, prop) {
        if (
          prop === "then" ||
          prop === "catch" ||
          prop === "finally"
        ) {
          return undefined;
        }

        if (prop === Symbol.toStringTag) return "DisabledSupabaseQuery";

        return (..._args) => builder;
      },
      apply() {
        return builder;
      },
    }
  );

  builder.select = (..._args) => builder;
  builder.eq = (..._args) => builder;
  builder.neq = (..._args) => builder;
  builder.gt = (..._args) => builder;
  builder.gte = (..._args) => builder;
  builder.lt = (..._args) => builder;
  builder.lte = (..._args) => builder;
  builder.ilike = (..._args) => builder;
  builder.like = (..._args) => builder;
  builder.in = (..._args) => builder;
  builder.contains = (..._args) => builder;
  builder.or = (..._args) => builder;
  builder.order = (..._args) => builder;
  builder.range = (..._args) => builder;
  builder.limit = (..._args) => builder;
  builder.single = fail;
  builder.maybeSingle = fail;
  builder.insert = fail;
  builder.update = fail;
  builder.upsert = fail;
  builder.delete = fail;
  builder.rpc = fail;
  builder.then = undefined;

  return builder;
}

function makeDisabledStorage() {
  return {
    from: () => ({
      upload: async () => {
        throw buildConfigError();
      },
      download: async () => {
        throw buildConfigError();
      },
      remove: async () => {
        throw buildConfigError();
      },
      list: async () => {
        throw buildConfigError();
      },
      move: async () => {
        throw buildConfigError();
      },
      createSignedUrl: async () => {
        throw buildConfigError();
      },
      createSignedUploadUrl: async () => {
        throw buildConfigError();
      },
    }),
  };
}

function makeDisabledRealtimeChannel() {
  return {
    on: () => makeDisabledRealtimeChannel(),
    subscribe: async () => ({ error: buildConfigError() }),
    unsubscribe: async () => ({ error: buildConfigError() }),
  };
}

function createDisabledClient() {
  return {
    __disabled: true,
    __error: buildConfigError().message,
    auth: {
      getUser: async () => ({
        data: { user: null },
        error: buildConfigError(),
      }),
      getSession: async () => ({
        data: { session: null },
        error: buildConfigError(),
      }),
      signInWithOtp: async () => {
        throw buildConfigError();
      },
      signInWithPassword: async () => {
        throw buildConfigError();
      },
      exchangeCodeForSession: async () => ({
        data: { session: null },
        error: buildConfigError(),
      }),
      verifyOtp: async () => ({
        data: { session: null },
        error: buildConfigError(),
      }),
      signOut: async () => ({
        error: buildConfigError(),
      }),
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe() {},
          },
        },
      }),
    },
    from: () => makeDisabledQueryBuilder(),
    rpc: async () => {
      throw buildConfigError();
    },
    storage: makeDisabledStorage(),
    channel: () => makeDisabledRealtimeChannel(),
    removeChannel: async () => ({ error: null }),
    getChannels: () => [],
  };
}

export function isServerSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY && createClient);
}

export function getServerSupabaseConfigError() {
  return isServerSupabaseConfigured() ? null : buildConfigError();
}

export function serverSupabase() {
  if (!isServerSupabaseConfigured()) {
    return createDisabledClient();
  }

  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "x-client-info": "unicos-admin-server",
      },
    },
  });

  return cachedClient;
}

export async function requireUserFromToken(sb, token) {
  if (!token) {
    return { user: null, error: "Missing Bearer token" };
  }

  if (!sb || typeof sb.auth?.getUser !== "function") {
    return { user: null, error: "Supabase server no configurado" };
  }

  const { data, error } = await sb.auth.getUser(token);

  if (error || !data?.user) {
    return { user: null, error: error?.message || "Invalid token" };
  }

  return { user: data.user, error: null };
}
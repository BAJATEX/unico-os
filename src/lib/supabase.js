import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "";

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

export const SUPABASE_CONFIGURED = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && createClient
);

function buildConfigError() {
  const missing = [];

  if (!SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!SUPABASE_ANON_KEY) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return new Error(
    `Supabase no configurado: falta ${missing.join(" y ")}.`
  );
}

function configResult() {
  const error = buildConfigError();
  return {
    data: {
      session: null,
      user: null,
    },
    error,
  };
}

function configActionResult() {
  return {
    data: null,
    error: buildConfigError(),
  };
}

function createDisabledQueryBuilder() {
  const terminal = async () => ({
    data: null,
    error: buildConfigError(),
  });

  const builder = {};

  const chain = () => builder;

  builder.select = chain;
  builder.eq = chain;
  builder.neq = chain;
  builder.gt = chain;
  builder.gte = chain;
  builder.lt = chain;
  builder.lte = chain;
  builder.like = chain;
  builder.ilike = chain;
  builder.in = chain;
  builder.contains = chain;
  builder.or = chain;
  builder.order = chain;
  builder.limit = chain;
  builder.range = chain;
  builder.order = chain;
  builder.match = chain;
  builder.single = terminal;
  builder.maybeSingle = terminal;
  builder.insert = terminal;
  builder.update = terminal;
  builder.upsert = terminal;
  builder.delete = terminal;
  builder.rpc = terminal;

  return builder;
}

function createDisabledStorage() {
  const terminal = async () => ({
    data: null,
    error: buildConfigError(),
  });

  return {
    from() {
      return {
        upload: terminal,
        download: terminal,
        remove: terminal,
        list: terminal,
        move: terminal,
        createSignedUrl: terminal,
        createSignedUploadUrl: terminal,
      };
    },
  };
}

function createDisabledChannel() {
  return {
    on() {
      return this;
    },
    subscribe() {
      return Promise.resolve({ data: null, error: buildConfigError() });
    },
    unsubscribe() {
      return Promise.resolve({ error: null });
    },
  };
}

function createDisabledClient() {
  return {
    __disabled: true,
    auth: {
      getSession: async () => configResult(),
      getUser: async () => configResult(),
      signInWithOtp: async () => configActionResult(),
      signInWithPassword: async () => configActionResult(),
      exchangeCodeForSession: async () => configResult(),
      verifyOtp: async () => configResult(),
      signOut: async () => configActionResult(),
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe() {},
          },
        },
      }),
    },
    from: () => createDisabledQueryBuilder(),
    rpc: async () => configActionResult(),
    storage: createDisabledStorage(),
    channel: () => createDisabledChannel(),
    removeChannel: async () => ({ error: null }),
    getChannels: () => [],
  };
}

export const supabase = SUPABASE_CONFIGURED
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          "x-client-info": "unicos-admin-web",
        },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : createDisabledClient();
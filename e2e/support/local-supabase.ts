import { execSync } from "node:child_process";

export type LocalSupabase = { url: string; publishableKey: string; serviceRoleKey: string };

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "0.0.0.0", "::1"]);

/** Tests seed and delete data, so they must never touch a hosted (production) project. */
export function assertLocal(url: string) {
  const host = new URL(url).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`E2E tests only run against the local Supabase stack, refusing ${host}.`);
  }
}

/**
 * Connection details of the local Supabase stack (`npx supabase start`).
 * Resolved once in the main process and passed to workers through the environment.
 */
export function localSupabase(): LocalSupabase {
  let env: LocalSupabase;
  if (process.env.E2E_SUPABASE_URL && process.env.E2E_SUPABASE_PUBLISHABLE_KEY && process.env.E2E_SUPABASE_SERVICE_ROLE_KEY) {
    env = {
      url: process.env.E2E_SUPABASE_URL,
      publishableKey: process.env.E2E_SUPABASE_PUBLISHABLE_KEY,
      serviceRoleKey: process.env.E2E_SUPABASE_SERVICE_ROLE_KEY,
    };
  } else {
    let raw: string;
    try {
      raw = execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      throw new Error("Local Supabase is not running. Start it with `npx supabase start`.");
    }
    const status = JSON.parse(raw.slice(raw.indexOf("{")));
    env = {
      url: status.API_URL,
      publishableKey: status.PUBLISHABLE_KEY ?? status.ANON_KEY,
      serviceRoleKey: status.SERVICE_ROLE_KEY,
    };
    process.env.E2E_SUPABASE_URL = env.url;
    process.env.E2E_SUPABASE_PUBLISHABLE_KEY = env.publishableKey;
    process.env.E2E_SUPABASE_SERVICE_ROLE_KEY = env.serviceRoleKey;
  }
  assertLocal(env.url);
  return env;
}

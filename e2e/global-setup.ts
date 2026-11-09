import fs from "node:fs";
import { localSupabase } from "./support/local-supabase";
import { AUTH_DIR, SEED_FILE } from "./support/qa";
import { seedQa } from "./support/seed";

export default async function globalSetup() {
  const env = localSupabase();
  const seed = await seedQa(env);
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2));
}

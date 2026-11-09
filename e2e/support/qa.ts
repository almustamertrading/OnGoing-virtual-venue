import fs from "node:fs";
import path from "node:path";

/**
 * Synthetic QA fixtures. Reserved .test domains only; local database only.
 * E2E_NAMESPACE gives each parallel workstream its own organisation and users, so several
 * test runs can share one local database without touching each other's data.
 */
const NS = (process.env.E2E_NAMESPACE ?? "qa").toLowerCase().replace(/[^a-z0-9-]/g, "") || "qa";
const DEFAULT_NS = NS === "qa";
const DOMAIN = DEFAULT_NS ? "qa.ongoing.test" : `${NS}.ongoing.test`;

export const QA = {
  namespace: NS,
  orgName: DEFAULT_NS ? "QA Events Co" : `QA ${NS} Co`,
  domain: DOMAIN,
  // Throw-away password for the local test database; never used anywhere else.
  password: "Local-QA-only-2026!",
  users: {
    admin: `admin@${DOMAIN}`,
    finance: `finance@${DOMAIN}`,
    sales: `sales@${DOMAIN}`,
    pm: `pm@${DOMAIN}`,
    ops: `ops@${DOMAIN}`,
    viewer: `viewer@${DOMAIN}`,
    // Used only by tests that change its password or sessions.
    account: `account@${DOMAIN}`,
    outsider: DEFAULT_NS ? "outsider@outsider.test" : `outsider@${NS}-outsider.test`,
  },
  project: "QA Gala Dinner",
  proposal: "QA Hospitality Proposal",
} as const;

export type QaRole = keyof typeof QA.users;

export type SeedResult = {
  organizationId: string;
  projectId: string;
  proposalId: string;
  userIds: Record<QaRole, string>;
};

export const AUTH_DIR = path.join(__dirname, "..", ".auth", NS);
export const SEED_FILE = path.join(AUTH_DIR, "seed.json");
export const authFile = (role: QaRole) => path.join(AUTH_DIR, `${role}.json`);

export function readSeed(): SeedResult {
  return JSON.parse(fs.readFileSync(SEED_FILE, "utf8")) as SeedResult;
}

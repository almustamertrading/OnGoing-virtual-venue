import fs from "node:fs";
import path from "node:path";

/** Synthetic QA fixtures. Reserved .test domains only; local database only. */
export const QA = {
  orgName: "QA Events Co",
  domain: "qa.ongoing.test",
  // Throw-away password for the local test database; never used anywhere else.
  password: "Local-QA-only-2026!",
  users: {
    admin: "admin@qa.ongoing.test",
    finance: "finance@qa.ongoing.test",
    sales: "sales@qa.ongoing.test",
    pm: "pm@qa.ongoing.test",
    ops: "ops@qa.ongoing.test",
    viewer: "viewer@qa.ongoing.test",
    outsider: "outsider@outsider.test",
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

export const AUTH_DIR = path.join(__dirname, "..", ".auth");
export const SEED_FILE = path.join(AUTH_DIR, "seed.json");
export const authFile = (role: QaRole) => path.join(AUTH_DIR, `${role}.json`);

export function readSeed(): SeedResult {
  return JSON.parse(fs.readFileSync(SEED_FILE, "utf8")) as SeedResult;
}

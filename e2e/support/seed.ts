import { createClient } from "@supabase/supabase-js";
import type { LocalSupabase } from "./local-supabase";
import { QA, type QaRole, type SeedResult } from "./qa";

/**
 * Recreates the QA organisation from scratch: removes the previous run's QA org (cascade)
 * and QA users, then creates users per capability and a project with finance data.
 * Uses the local service-role key, which bypasses RLS; tests then act as real users.
 */
export async function seedQa(env: LocalSupabase): Promise<SeedResult> {
  const db = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  type Res<T> = { data: T; error: { message: string } | null };
  /** Fails on an error; returns whatever data came back (possibly null). */
  const check = <T>(res: Res<T>, what: string): T => {
    if (res.error) throw new Error(`Seed failed (${what}): ${res.error.message}`);
    return res.data;
  };
  /** Fails on an error or when no row came back. */
  const must = <T>(res: Res<T>, what: string): NonNullable<T> => {
    const data = check(res, what);
    if (data == null) throw new Error(`Seed failed (${what}): no row returned`);
    return data as NonNullable<T>;
  };

  // 1. Remove the previous run.
  const old = check(await db.from("organization_domains").select("organization_id").eq("domain", QA.domain).maybeSingle(), "find old org");
  if (old) check(await db.from("organizations").delete().eq("id", old.organization_id), "delete old org");
  const emails = new Set<string>(Object.values(QA.users));
  const { data: list, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw new Error(`Seed failed (list users): ${listError.message}`);
  for (const u of list.users) {
    if (u.email && emails.has(u.email)) {
      const { error } = await db.auth.admin.deleteUser(u.id);
      if (error) throw new Error(`Seed failed (delete ${u.email}): ${error.message}`);
    }
  }

  // 2. Organisation and its email domain (members join through it).
  const org = must(await db.from("organizations").insert({ name: QA.orgName, email_domain: QA.domain }).select("id").single(), "org");
  check(await db.from("organization_domains").insert({ domain: QA.domain, organization_id: org.id }), "domain");

  // 3. Users. The first one on the domain becomes the organisation admin.
  const userIds = {} as Record<QaRole, string>;
  for (const [role, email] of Object.entries(QA.users) as [QaRole, string][]) {
    const { data, error } = await db.auth.admin.createUser({ email, password: QA.password, email_confirm: true });
    if (error || !data.user) throw new Error(`Seed failed (create ${email}): ${error?.message}`);
    userIds[role] = data.user.id;
  }
  const grant = async (role: QaRole, capabilities: string[]) =>
    check(await db.from("organization_members").update({ capabilities }).eq("user_id", userIds[role]), `grant ${role}`);
  await grant("finance", ["finance_access"]);
  await grant("sales", ["sales_access"]);
  await grant("pm", ["project_manager"]);
  await grant("ops", ["operations_access"]);

  // 4. A project the finance, sales, ops and viewer users belong to.
  const admin = userIds.admin;
  const project = must(
    await db.from("projects").insert({
      organization_id: org.id, name: QA.project, status: "confirmed", project_type: "corporate_event",
      budget: 500000, created_by: admin,
    }).select("id").single(),
    "project",
  );
  check(await db.from("project_members").insert([
    { project_id: project.id, user_id: userIds.finance, role: "viewer" },
    { project_id: project.id, user_id: userIds.sales, role: "editor" },
    { project_id: project.id, user_id: userIds.ops, role: "editor" },
    { project_id: project.id, user_id: userIds.viewer, role: "viewer" },
  ]), "members");

  check(await db.from("invoices").insert({ project_id: project.id, number: "QA-INV-1", title: "QA deposit invoice", amount: 150000, status: "sent", created_by: admin }), "invoice");
  check(await db.from("expenses").insert({ project_id: project.id, label: "QA venue hire", amount: 90000, created_by: admin }), "expense");
  const rfq = must(await db.from("rfqs").insert({ project_id: project.id, title: "QA sound and light", created_by: admin }).select("id").single(), "rfq");
  check(await db.from("quotes").insert({ rfq_id: rfq.id, project_id: project.id, supplier_name: "QA Audio Supplier", amount: 42000, created_by: admin }), "quote");

  // 5. Organisation-level records with internal costs.
  check(await db.from("suppliers").insert({ organization_id: org.id, name: "QA Catering Supplier", category: "ضيافة", created_by: admin }), "supplier");
  const inv = must(await db.from("inventory_items").insert({ organization_id: org.id, name: "QA Chairs", quantity: 200, created_by: admin }).select("id").single(), "inventory");
  check(await db.from("inventory_item_costs").insert({ item_id: inv.id, organization_id: org.id, unit_rate: 35 }), "inventory cost");

  const proposal = must(
    await db.from("proposals").insert({
      organization_id: org.id, title: QA.proposal, proposal_type: "technical_financial", status: "draft",
      owner_id: admin, created_by: admin,
    }).select("id").single(),
    "proposal",
  );
  const item = must(
    await db.from("proposal_items").insert({
      proposal_id: proposal.id, organization_id: org.id, description: "QA stage build", quantity: 2,
      unit: "set", unit_price: 30000, created_by: admin,
    }).select("id").single(),
    "proposal item",
  );
  check(await db.from("proposal_item_costs").insert({ item_id: item.id, organization_id: org.id, unit_cost: 18000 }), "proposal cost");

  return { organizationId: org.id, projectId: project.id, proposalId: proposal.id, userIds };
}

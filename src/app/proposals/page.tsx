import { redirect } from "next/navigation";
import { getMyOrganization } from "@/lib/project";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { ClientRow, ProposalItemRow, ProposalRow } from "@/lib/types";
import { ProposalsDashboard, type TemplateOption } from "./proposals-dashboard";
import { proposalTotals } from "@/lib/money";

export const metadata = { title: "العروض | OnGoing" };

export default async function ProposalsPage() {
  if (!(await getUserId())) redirect("/login?next=/proposals");
  const org = await getMyOrganization();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const email = (claims?.claims?.email as string | undefined) ?? "";

  if (!org) {
    return (
      <ProposalsDashboard email={email} organizationId="" canCreate={false} currency="SAR" proposals={[]} clients={[]} templates={[]} values={{}} />
    );
  }

  const [{ data: proposals }, { data: items }, { data: clients }, { data: templates }] = await Promise.all([
    supabase.from("proposals").select("*").eq("organization_id", org.id).order("created_at", { ascending: false }),
    supabase.from("proposal_items").select("proposal_id, quantity, unit_price, is_optional").eq("organization_id", org.id),
    supabase.from("clients").select("*").eq("organization_id", org.id).order("name"),
    supabase.from("proposal_templates").select("id, name, proposal_type").eq("organization_id", org.id).order("name"),
  ]);

  const byProposal = new Map<string, Pick<ProposalItemRow, "quantity" | "unit_price" | "is_optional">[]>();
  for (const it of (items as Pick<ProposalItemRow, "proposal_id" | "quantity" | "unit_price" | "is_optional">[]) ?? []) {
    byProposal.set(it.proposal_id, [...(byProposal.get(it.proposal_id) ?? []), it]);
  }
  const values: Record<string, number> = {};
  for (const [id, list] of byProposal) values[id] = proposalTotals(list, 0).subtotal;

  return (
    <ProposalsDashboard
      email={email}
      organizationId={org.id}
      canCreate={org.access.sales}
      currency={org.currency ?? "SAR"}
      proposals={(proposals as ProposalRow[]) ?? []}
      clients={(clients as ClientRow[]) ?? []}
      templates={(templates as TemplateOption[]) ?? []}
      values={values}
    />
  );
}

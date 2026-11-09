import { redirect } from "next/navigation";
import { getMyOrganization } from "@/lib/project";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { ClientRow, ProposalItemRow, ProposalRow } from "@/lib/types";
import { ProposalsDashboard } from "./proposals-dashboard";

export const metadata = { title: "العروض | OnGoing" };

export default async function ProposalsPage() {
  if (!(await getUserId())) redirect("/login?next=/proposals");
  const org = await getMyOrganization();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const email = (claims?.claims?.email as string | undefined) ?? "";

  if (!org) {
    return (
      <ProposalsDashboard email={email} organizationId="" currency="SAR" proposals={[]} clients={[]} values={{}} />
    );
  }

  const [{ data: proposals }, { data: items }, { data: clients }] = await Promise.all([
    supabase.from("proposals").select("*").eq("organization_id", org.id).order("created_at", { ascending: false }),
    supabase.from("proposal_items").select("proposal_id, quantity, unit_price, is_optional").eq("organization_id", org.id),
    supabase.from("clients").select("*").eq("organization_id", org.id).order("name"),
  ]);

  const values: Record<string, number> = {};
  for (const it of (items as Pick<ProposalItemRow, "proposal_id" | "quantity" | "unit_price" | "is_optional">[]) ?? []) {
    if (it.is_optional) continue;
    values[it.proposal_id] = (values[it.proposal_id] ?? 0) + Number(it.quantity) * Number(it.unit_price);
  }

  return (
    <ProposalsDashboard
      email={email}
      organizationId={org.id}
      currency={org.currency ?? "SAR"}
      proposals={(proposals as ProposalRow[]) ?? []}
      clients={(clients as ClientRow[]) ?? []}
      values={values}
    />
  );
}

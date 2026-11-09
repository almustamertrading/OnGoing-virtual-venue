import { notFound, redirect } from "next/navigation";
import { getMyOrganization } from "@/lib/project";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { ClientRow, ProposalItemRow, ProposalRow, ProposalSectionRow } from "@/lib/types";
import { ProposalWorkspace } from "./proposal-workspace";

export default async function ProposalPage({ params }: PageProps<"/proposals/[id]">) {
  const { id } = await params;
  if (!(await getUserId())) redirect(`/login?next=/proposals/${id}`);
  const org = await getMyOrganization();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const email = (claims?.claims?.email as string | undefined) ?? "";

  const { data: proposal } = await supabase.from("proposals").select("*").eq("id", id).maybeSingle();
  if (!proposal) notFound();

  const [{ data: sections }, { data: items }, { data: client }, { data: clients }] = await Promise.all([
    supabase.from("proposal_sections").select("*").eq("proposal_id", id).order("sort_order"),
    supabase.from("proposal_items").select("*").eq("proposal_id", id).order("sort_order"),
    proposal.client_id
      ? supabase.from("clients").select("*").eq("id", proposal.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("clients").select("*").eq("organization_id", proposal.organization_id).order("name"),
  ]);

  // Internal costs are finance-only (RLS enforces the same rule); everyone else never receives them.
  const canSeeCost = Boolean(org?.access.finance);
  const itemRows = (items as ProposalItemRow[]) ?? [];
  const { data: costs } =
    canSeeCost && itemRows.length
      ? await supabase.from("proposal_item_costs").select("item_id, unit_cost").in("item_id", itemRows.map((i) => i.id))
      : { data: [] };
  const costById = new Map(((costs as { item_id: string; unit_cost: number }[]) ?? []).map((c) => [c.item_id, Number(c.unit_cost)]));

  return (
    <ProposalWorkspace
      email={email}
      companyName={org?.name ?? "OnGoing"}
      currency={org?.currency ?? "SAR"}
      canEdit={Boolean(org?.access.sales)}
      canDelete={org?.role === "admin" || org?.role === "manager"}
      canSeeCost={canSeeCost}
      proposal={proposal as ProposalRow}
      sections={(sections as ProposalSectionRow[]) ?? []}
      items={itemRows.map((i) => ({ ...i, unit_cost: costById.get(i.id) ?? 0 }))}
      client={(client as ClientRow | null) ?? null}
      clients={(clients as ClientRow[]) ?? []}
    />
  );
}

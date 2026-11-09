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

  return (
    <ProposalWorkspace
      email={email}
      companyName={org?.name ?? "OnGoing"}
      currency={org?.currency ?? "SAR"}
      canEdit={Boolean(org)}
      proposal={proposal as ProposalRow}
      sections={(sections as ProposalSectionRow[]) ?? []}
      items={(items as ProposalItemRow[]) ?? []}
      client={(client as ClientRow | null) ?? null}
      clients={(clients as ClientRow[]) ?? []}
    />
  );
}

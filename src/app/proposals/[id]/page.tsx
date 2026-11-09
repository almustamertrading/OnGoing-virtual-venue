import { notFound, redirect } from "next/navigation";
import { getAiStatus } from "@/lib/ai/status";
import { getMyOrganization } from "@/lib/project";
import { createClient, getUserId } from "@/lib/supabase/server";
import type {
  ClientRow, ProposalItemRow, ProposalReviewRow, ProposalRow, ProposalSectionRow, ProposalVersionRow,
} from "@/lib/types";
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

  const [{ data: sections }, { data: items }, { data: client }, { data: clients }, { data: versions }, { data: reviews }, { data: template }] =
    await Promise.all([
      supabase.from("proposal_sections").select("*").eq("proposal_id", id).order("sort_order"),
      supabase.from("proposal_items").select("*").eq("proposal_id", id).order("sort_order"),
      proposal.client_id
        ? supabase.from("clients").select("*").eq("id", proposal.client_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("clients").select("*").eq("organization_id", proposal.organization_id).order("name"),
      // The list only; snapshots are read on the version page.
      supabase
        .from("proposal_versions")
        .select("id, proposal_id, organization_id, version, status, note, created_by, created_at")
        .eq("proposal_id", id)
        .order("version", { ascending: false }),
      supabase.from("proposal_reviews").select("*").eq("proposal_id", id).order("created_at", { ascending: false }),
      proposal.template_id
        ? supabase.from("proposal_templates").select("name").eq("id", proposal.template_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  // Internal costs are finance-only (RLS enforces the same rule); everyone else never receives them.
  const canSeeCost = Boolean(org?.access.finance);
  const itemRows = (items as ProposalItemRow[]) ?? [];
  const { data: costs } =
    canSeeCost && itemRows.length
      ? await supabase.from("proposal_item_costs").select("item_id, unit_cost").in("item_id", itemRows.map((i) => i.id))
      : { data: [] };
  const costById = new Map(((costs as { item_id: string; unit_cost: number }[]) ?? []).map((c) => [c.item_id, Number(c.unit_cost)]));

  // Names for the history: versions' authors, reviewers and the approver.
  const versionRows = (versions as ProposalVersionRow[]) ?? [];
  const reviewRows = (reviews as ProposalReviewRow[]) ?? [];
  const personIds = [
    ...new Set(
      [...versionRows.map((v) => v.created_by), ...reviewRows.map((r) => r.reviewer_id), proposal.approved_by].filter(
        (v): v is string => Boolean(v),
      ),
    ),
  ];
  const { data: profiles } = personIds.length
    ? await supabase.from("profiles").select("id, email, display_name").in("id", personIds)
    : { data: [] };
  const people: Record<string, string> = Object.fromEntries(
    ((profiles as { id: string; email: string; display_name: string | null }[]) ?? []).map((p) => [p.id, p.display_name || p.email]),
  );

  const canEdit = Boolean(org?.access.sales);
  const isManager = org?.role === "admin" || org?.role === "manager";
  const aiStatus = canEdit ? await getAiStatus(supabase, "proposal_draft") : null;

  return (
    <ProposalWorkspace
      email={email}
      companyName={org?.name ?? "OnGoing"}
      currency={org?.currency ?? "SAR"}
      canEdit={canEdit}
      isManager={isManager}
      canDelete={isManager}
      canSeeCost={canSeeCost}
      proposal={proposal as ProposalRow}
      sections={(sections as ProposalSectionRow[]) ?? []}
      items={itemRows.map((i) => ({ ...i, unit_cost: costById.get(i.id) ?? 0 }))}
      client={(client as ClientRow | null) ?? null}
      clients={(clients as ClientRow[]) ?? []}
      versions={versionRows}
      reviews={reviewRows}
      people={people}
      templateName={(template as { name: string } | null)?.name ?? null}
      aiStatus={aiStatus}
    />
  );
}

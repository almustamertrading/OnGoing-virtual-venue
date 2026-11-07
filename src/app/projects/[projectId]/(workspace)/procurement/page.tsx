import { getProjectContext } from "@/lib/project";
import type { QuoteRow, RfqRow, SupplierRow } from "@/lib/types";
import { ProcurementBoard } from "./procurement-board";

export default async function ProcurementPage({ params }: PageProps<"/projects/[projectId]/procurement">) {
  const { projectId } = await params;
  const { supabase, canEdit, organization } = await getProjectContext(projectId);

  const [{ data: suppliers }, { data: rfqs }, { data: quotes }] = await Promise.all([
    organization
      ? supabase.from("suppliers").select("*").eq("organization_id", organization.id).order("name")
      : Promise.resolve({ data: [] }),
    supabase.from("rfqs").select("*").eq("project_id", projectId).order("sort_order", { ascending: false }),
    supabase.from("quotes").select("*").eq("project_id", projectId).order("amount", { nullsFirst: false }),
  ]);

  return (
    <ProcurementBoard
      projectId={projectId}
      organizationId={organization?.id ?? ""}
      currency={organization?.currency ?? "SAR"}
      canEdit={canEdit}
      suppliers={(suppliers as SupplierRow[]) ?? []}
      rfqs={(rfqs as RfqRow[]) ?? []}
      quotes={(quotes as QuoteRow[]) ?? []}
    />
  );
}

import { todayIso } from "@/lib/format";
import { getProjectContext } from "@/lib/project";
import type { QuoteRow, RfqRow, SupplierRow } from "@/lib/types";
import { ProcurementBoard } from "./procurement-board";

export const metadata = { title: "المشتريات | OnGoing" };

export default async function ProcurementPage({ params }: PageProps<"/projects/[projectId]/procurement">) {
  const { projectId } = await params;
  const { supabase, canEdit, organization, access, orgRole, canSeeFinance, project, members } = await getProjectContext(projectId);

  const [{ data: suppliers }, { data: rfqs }, { data: quotes }] = await Promise.all([
    organization
      ? supabase.from("suppliers").select("*").eq("organization_id", organization.id).order("name")
      : Promise.resolve({ data: [] }),
    supabase.from("rfqs").select("*").eq("project_id", projectId).order("sort_order", { ascending: false }),
    // Supplier quotes are internal costs: finance only (RLS enforces the same rule).
    canSeeFinance
      ? supabase.from("quotes").select("*").eq("project_id", projectId).order("amount", { nullsFirst: false })
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <ProcurementBoard
      projectId={projectId}
      organizationId={organization?.id ?? ""}
      currency={organization?.currency ?? "SAR"}
      canEdit={canEdit}
      canSeeQuotes={canSeeFinance}
      canManageSuppliers={access.operations || access.finance}
      canDeleteSuppliers={orgRole === "admin" || orgRole === "manager"}
      suppliers={(suppliers as SupplierRow[]) ?? []}
      rfqs={(rfqs as RfqRow[]) ?? []}
      quotes={(quotes as QuoteRow[]) ?? []}
      eventStart={project.start_date}
      today={todayIso()}
      people={Object.fromEntries(members.map((m) => [m.user_id, m.email]))}
    />
  );
}

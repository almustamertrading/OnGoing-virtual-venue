import { getProjectContext } from "@/lib/project";
import type { BoqItemRow, ExpenseRow, InvoiceRow } from "@/lib/types";
import { FinanceBoard } from "./finance-board";

export default async function FinancePage({ params }: PageProps<"/projects/[projectId]/finance">) {
  const { projectId } = await params;
  const { supabase, canEdit, project, organization } = await getProjectContext(projectId);

  const [{ data: invoices }, { data: expenses }, { data: boq }] = await Promise.all([
    supabase.from("invoices").select("*").eq("project_id", projectId).order("sort_order", { ascending: false }),
    supabase.from("expenses").select("*").eq("project_id", projectId).order("sort_order", { ascending: false }),
    supabase.from("boq_items").select("quantity, unit_price").eq("project_id", projectId),
  ]);

  const quoted = ((boq as Pick<BoqItemRow, "quantity" | "unit_price">[]) ?? []).reduce(
    (s, b) => s + (b.quantity != null && b.unit_price != null ? b.quantity * b.unit_price : 0),
    0,
  );

  return (
    <FinanceBoard
      projectId={projectId}
      currency={organization?.currency ?? "SAR"}
      canEdit={canEdit}
      budget={project.budget}
      quoted={quoted}
      invoices={(invoices as InvoiceRow[]) ?? []}
      expenses={(expenses as ExpenseRow[]) ?? []}
    />
  );
}

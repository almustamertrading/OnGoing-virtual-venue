import { Restricted } from "@/components/restricted";
import { getProjectContext } from "@/lib/project";
import type { BoqItemRow, ExpenseRow, InvoiceRow } from "@/lib/types";
import { FinanceBoard } from "./finance-board";
import { boqTotal } from "@/lib/money";

export default async function FinancePage({ params }: PageProps<"/projects/[projectId]/finance">) {
  const { projectId } = await params;
  const { supabase, project, organization, canSeeFinance } = await getProjectContext(projectId);
  if (!canSeeFinance) return <Restricted title="المالية مقيدة" />;

  const [{ data: invoices }, { data: expenses }, { data: boq }] = await Promise.all([
    supabase.from("invoices").select("*").eq("project_id", projectId).order("sort_order", { ascending: false }),
    supabase.from("expenses").select("*").eq("project_id", projectId).order("sort_order", { ascending: false }),
    supabase.from("boq_items").select("quantity, unit_price").eq("project_id", projectId),
  ]);

  const quoted = boqTotal((boq as Pick<BoqItemRow, "quantity" | "unit_price">[]) ?? []);

  return (
    <FinanceBoard
      projectId={projectId}
      currency={organization?.currency ?? "SAR"}
      canEdit={canSeeFinance}
      budget={project.budget}
      quoted={quoted}
      invoices={(invoices as InvoiceRow[]) ?? []}
      expenses={(expenses as ExpenseRow[]) ?? []}
    />
  );
}

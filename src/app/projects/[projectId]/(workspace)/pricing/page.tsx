import { getProjectContext } from "@/lib/project";
import type { BoqItemRow } from "@/lib/types";
import { PricingTable } from "./pricing-table";

export default async function PricingPage({ params }: PageProps<"/projects/[projectId]/pricing">) {
  const { projectId } = await params;
  const { supabase, canEdit, organization } = await getProjectContext(projectId);
  const { data } = await supabase
    .from("boq_items")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");
  const items = (data as BoqItemRow[]) ?? [];

  return (
    <PricingTable
      projectId={projectId}
      items={items}
      canEdit={canEdit}
      currency={organization?.currency ?? "SAR"}
    />
  );
}

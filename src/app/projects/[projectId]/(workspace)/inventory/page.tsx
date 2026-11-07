import { getProjectContext } from "@/lib/project";
import type { InventoryItemRow } from "@/lib/types";
import { InventoryBoard } from "./inventory-board";

export default async function InventoryPage({ params }: PageProps<"/projects/[projectId]/inventory">) {
  const { projectId } = await params;
  const { supabase, orgRole, organization } = await getProjectContext(projectId);
  const { data } = organization
    ? await supabase.from("inventory_items").select("*").eq("organization_id", organization.id).order("name")
    : { data: [] };

  return (
    <InventoryBoard
      organizationId={organization?.id ?? ""}
      currency={organization?.currency ?? "SAR"}
      canManage={Boolean(orgRole)}
      items={(data as InventoryItemRow[]) ?? []}
    />
  );
}

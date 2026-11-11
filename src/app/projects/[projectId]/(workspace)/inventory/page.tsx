import { getProjectContext } from "@/lib/project";
import type { InventoryItemRow } from "@/lib/types";
import { InventoryBoard } from "./inventory-board";

export const metadata = { title: "المخزون | OnGoing" };

export default async function InventoryPage({ params }: PageProps<"/projects/[projectId]/inventory">) {
  const { projectId } = await params;
  const { supabase, orgRole, organization, access } = await getProjectContext(projectId);
  const [{ data }, { data: costs }] = organization
    ? await Promise.all([
        supabase.from("inventory_items").select("*").eq("organization_id", organization.id).order("name"),
        // Valuation is finance-only (RLS enforces the same rule).
        access.finance
          ? supabase.from("inventory_item_costs").select("item_id, unit_rate").eq("organization_id", organization.id)
          : Promise.resolve({ data: [] }),
      ])
    : [{ data: [] }, { data: [] }];

  const rateById = new Map(((costs as { item_id: string; unit_rate: number }[]) ?? []).map((c) => [c.item_id, Number(c.unit_rate)]));
  const items = ((data as InventoryItemRow[]) ?? []).map((it) => ({ ...it, unit_rate: rateById.get(it.id) ?? null }));

  return (
    <InventoryBoard
      organizationId={organization?.id ?? ""}
      currency={organization?.currency ?? "SAR"}
      canManage={access.operations}
      canSeeValue={access.finance}
      canDelete={orgRole === "admin" || orgRole === "manager"}
      items={items}
    />
  );
}

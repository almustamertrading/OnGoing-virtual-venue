import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { getProjectContext } from "@/lib/project";
import type { VenueRow } from "@/lib/types";
import { VenueCreator } from "./venue-creator";

export default async function VenuesPage({ params }: PageProps<"/projects/[projectId]/venues">) {
  const { projectId } = await params;
  const { supabase, canEdit } = await getProjectContext(projectId);
  const { data } = await supabase.from("venues").select("*").eq("project_id", projectId).order("created_at");
  const venues = (data as VenueRow[]) ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Venues and sites</h2>
        {venues.length === 0 && (
          <div className="card p-6 text-sm text-slate-400">
            No venues yet.{canEdit ? " Add one to open the map planner." : ""}
          </div>
        )}
        <ul className="space-y-3">
          {venues.map((v) => (
            <li key={v.id}>
              <Link
                href={`/projects/${projectId}/venues/${v.id}`}
                className="card flex items-center gap-4 p-4 transition hover:border-emerald-700"
              >
                <MapPin size={18} className="text-emerald-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{v.name}</p>
                  {v.address && <p className="truncate text-xs text-slate-400">{v.address}</p>}
                </div>
                <span className="text-xs text-emerald-400">Open planner</span>
                <ChevronRight size={18} className="text-slate-500" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      {canEdit && <aside><VenueCreator projectId={projectId} /></aside>}
    </div>
  );
}

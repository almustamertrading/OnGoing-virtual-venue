import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import {
  ORG_WIDE,
  addDays,
  canContribute,
  editableProjectIds,
  minutesOfDay,
  parseCalendarParams,
  resolveTimeZone,
  todayInZone,
  visibleRange,
  zonedInputToUtc,
} from "@/lib/calendar";
import { permissionMessage } from "@/lib/permissions";
import { getMyOrganization } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import type { CalendarFeedItem } from "@/lib/types";
import { CalendarBoard, type EventDetails, type ProjectOption } from "./calendar-board";

export const metadata = { title: "التقويم | OnGoing" };

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  // First, because it calls connection(): everything below (including "today") is per request.
  const supabase = await createClient();
  const params = await searchParams;
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) redirect("/login?next=/calendar");
  const email = (claims?.claims?.email as string | undefined) ?? "";
  const org = await getMyOrganization();

  const header = (
    <AppHeader email={email}>
      <Link href="/projects" className="hover:text-white">Projects</Link>
      <ChevronRight size={14} aria-hidden />
      <span className="text-slate-200">التقويم</span>
    </AppHeader>
  );

  if (!org) {
    return (
      <>
        {header}
        <main dir="rtl" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          <h1 className="text-2xl font-semibold text-white">التقويم</h1>
          <div className="card mt-4 p-5 text-sm text-slate-300">
            حسابك ليس ضمن منظمة، لذلك لا يتوفر تقويم المنظمة. افتح المشاريع التي دُعيت إليها من صفحة المشاريع.
          </div>
        </main>
      </>
    );
  }

  const [{ data: orgRow }, { data: projectRows }, { data: memberships }] = await Promise.all([
    supabase.from("organizations").select("timezone").eq("id", org.id).maybeSingle(),
    supabase.from("projects").select("id, code, name").eq("organization_id", org.id).order("code"),
    supabase.from("project_members").select("project_id, role").eq("user_id", userId),
  ]);
  const timeZone = resolveTimeZone(orgRow?.timezone);
  const now = new Date();
  const today = todayInZone(timeZone, now);
  const state = parseCalendarParams(params, today);
  const projects = (projectRows as ProjectOption[] | null) ?? [];
  // A project the viewer cannot see, or invoices without finance access, are not usable filters.
  const project = state.project === ORG_WIDE || projects.some((p) => p.id === state.project) ? state.project : null;
  const types = org.access.finance ? state.types : state.types.filter((t) => t !== "invoice");
  const range = visibleRange(state.view, state.date);

  const [{ data: feed, error }, { data: eventRows }] = await Promise.all([
    // Everything dated in the range, filtered by the caller's own access (finance only for finance).
    supabase.rpc("calendar_feed", { org: org.id, range_start: range.start, range_end: range.end }),
    // The feed has no location or description; the event dialog needs them for custom events.
    supabase
      .from("calendar_events")
      .select("id, location, description")
      .eq("organization_id", org.id)
      .lt("starts_at", zonedInputToUtc(`${addDays(range.end, 1)}T00:00`, timeZone))
      .gte("ends_at", zonedInputToUtc(`${range.start}T00:00`, timeZone)),
  ]);

  const details: Record<string, EventDetails> = {};
  for (const e of (eventRows as { id: string; location: string; description: string }[] | null) ?? []) {
    details[e.id] = { location: e.location ?? "", description: e.description ?? "" };
  }

  return (
    <>
      {header}
      <CalendarBoard
        key={`${state.view}|${state.date}`}
        timeZone={timeZone}
        today={today}
        nowMinutes={minutesOfDay(now, timeZone)}
        view={state.view}
        anchor={state.date}
        explicitDate={state.explicitDate}
        range={range}
        initialFilters={{ project, types }}
        items={(feed as CalendarFeedItem[] | null) ?? []}
        details={details}
        projects={projects}
        canCreateOrgEvents={canContribute(org.access)}
        editableProjectIds={editableProjectIds(projects, memberships ?? [], org.access.isAdmin)}
        showInvoices={org.access.finance}
        feedError={error ? (permissionMessage(error) ?? "تعذّر تحميل التقويم.") : null}
      />
    </>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient, withRealtimeAuth } from "@/lib/supabase/client";

// Venue changes arrive through the activity log, which every write to a project table feeds.
const TABLES = ["tasks", "milestones", "scope_items", "activity"] as const;

/** Re-renders the page when a teammate changes this project's work items. */
export function LiveRefresh({ projectId }: { projectId: string }) {
  const router = useRouter();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    const schedule = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => router.refresh(), 400);
    };
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let stopped = false;
    // Realtime must carry the user's token before joining, or it subscribes as an anonymous visitor.
    withRealtimeAuth(supabase).then(() => {
      if (stopped) return;
      let ch = supabase.channel(`project:${projectId}:${Date.now()}`);
      for (const table of TABLES) {
        ch = ch.on(
          "postgres_changes",
          { event: "*", schema: "public", table, filter: `project_id=eq.${projectId}` },
          schedule,
        );
      }
      channel = ch.subscribe();
    });
    return () => {
      stopped = true;
      window.clearTimeout(timer.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [projectId, router]);

  return null;
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type {
  CommentRow,
  FeatureGeometry,
  FeatureRow,
  LayerRow,
  PanoramaRow,
  Profile,
} from "@/lib/types";

export type PresenceUser = { user_id: string; email: string; selected: string | null };

type Ids = { eventId: string; venueId: string; userId: string; email: string };

type Versioned = { id: string; updated_at?: string; _local?: boolean };

/** Insert or replace a row. Realtime events can arrive out of order, so a server row
 * older than the one already held is ignored, unless the held row is an optimistic
 * local edit (marked _local), which the server copy always replaces. */
function upsert<T extends Versioned>(list: T[], row: T) {
  const i = list.findIndex((r) => r.id === row.id);
  if (i === -1) return [...list, row];
  const held = list[i];
  if (!held._local && held.updated_at && row.updated_at) {
    // Timestamps can come in different ISO formats from REST and Realtime, so compare as dates.
    if (Date.parse(row.updated_at) < Date.parse(held.updated_at)) return list;
  }
  const next = list.slice();
  next[i] = row;
  return next;
}

export function useVenueData({ eventId, venueId, userId, email }: Ids) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerRow[]>([]);
  const [features, setFeatures] = useState<(FeatureRow & { _local?: boolean })[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [panoramas, setPanoramas] = useState<PanoramaRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [online, setOnline] = useState<{ user_id: string; email: string }[]>([]);
  const [connected, setConnected] = useState(false);
  const presenceRef = useRef<RealtimeChannel | null>(null);
  const selectedRef = useRef<string | null>(null);
  const selectTimer = useRef<number | undefined>(undefined);
  /** Inserts still in flight, so edits to a brand-new shape wait for it to exist. */
  const pendingCreates = useRef(new Map<string, PromiseLike<unknown>>());
  const [selections, setSelections] = useState<Record<string, string | null>>({});

  const report = useCallback((message: string) => {
    setError(message);
    window.setTimeout(() => setError((e) => (e === message ? null : e)), 6000);
  }, []);

  // Loads everything for the venue. Runs on open and again after a reconnect,
  // so changes made while the live connection was down are not missed.
  const loadAll = useCallback(async () => {
    const [l, f, c, p, m] = await Promise.all([
      supabase.from("layers").select("*").eq("venue_id", venueId).order("sort_order"),
      supabase
        .from("features")
        .select(
          "id, event_id, venue_id, layer_id, name, notes, geometry, properties, created_by, updated_by, created_at, updated_at",
        )
        .eq("venue_id", venueId),
      supabase.from("comments").select("*").eq("venue_id", venueId).order("created_at"),
      supabase.from("panoramas").select("*").eq("venue_id", venueId).order("created_at"),
      supabase.from("event_members").select("user_id").eq("event_id", eventId),
    ]);
    const firstError = [l, f, c, p, m].find((r) => r.error)?.error;
    if (firstError) report(firstError.message);
    if (!l.error) setLayers((l.data as LayerRow[]) ?? []);
    if (!f.error) setFeatures((f.data as FeatureRow[]) ?? []);
    if (!c.error) setComments((c.data as CommentRow[]) ?? []);
    if (!p.error) setPanoramas((p.data as PanoramaRow[]) ?? []);
    const ids = (m.data ?? []).map((r) => r.user_id as string);
    if (ids.length) {
      const { data } = await supabase.from("profiles").select("id, email, display_name").in("id", ids);
      setProfiles(Object.fromEntries((data ?? []).map((row) => [row.id, row as Profile])));
    }
    setLoading(false);
  }, [supabase, venueId, eventId, report]);

  // Realtime database changes. Reconnects with backoff if the channel drops.
  useEffect(() => {
    const filter = `venue_id=eq.${venueId}`;
    let channel: RealtimeChannel | null = null;
    let retry: number | undefined;
    let attempts = 0;
    let stopped = false;
    let firstLoad = true;

    const connect = () => {
      channel = supabase
        .channel(`venue-data:${venueId}:${Date.now()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "features", filter }, (payload) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id: string }).id;
            setFeatures((list) => list.filter((r) => r.id !== id));
          } else {
            setFeatures((list) => upsert(list, payload.new as FeatureRow));
          }
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "layers", filter }, (payload) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id: string }).id;
            setLayers((list) => list.filter((r) => r.id !== id));
            setFeatures((list) => list.filter((r) => r.layer_id !== id));
          } else {
            setLayers((list) =>
              upsert(list, payload.new as LayerRow).sort((a, b) => a.sort_order - b.sort_order),
            );
          }
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter }, (payload) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id: string }).id;
            setComments((list) => list.filter((r) => r.id !== id && r.parent_id !== id));
          } else {
            setComments((list) => upsert(list, payload.new as CommentRow));
          }
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "panoramas", filter }, (payload) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id: string }).id;
            setPanoramas((list) => list.filter((r) => r.id !== id));
          } else {
            setPanoramas((list) => upsert(list, payload.new as PanoramaRow));
          }
        })
        .subscribe((status) => {
          if (stopped) return;
          if (status === "SUBSCRIBED") {
            attempts = 0;
            setConnected(true);
            // Initial load, or catch up on anything missed while disconnected.
            loadAll();
            firstLoad = false;
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setConnected(false);
            const dead = channel;
            channel = null;
            if (dead) supabase.removeChannel(dead);
            window.clearTimeout(retry);
            const delay = Math.min(1000 * 2 ** attempts, 15000);
            attempts += 1;
            retry = window.setTimeout(() => {
              if (!stopped) connect();
            }, delay);
          }
        });
    };

    connect();
    // Show data even if the live connection is slow to come up.
    const fallback = window.setTimeout(() => {
      if (firstLoad) loadAll();
    }, 4000);

    return () => {
      stopped = true;
      window.clearTimeout(retry);
      window.clearTimeout(fallback);
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, venueId, loadAll]);

  // Who's here comes from Presence, tracked once per connection (Presence allows only a
  // few calls per client every 30 seconds). Live selections go over Broadcast instead.
  const sendSelection = useCallback(() => {
    if (selectTimer.current !== undefined) return;
    selectTimer.current = window.setTimeout(() => {
      selectTimer.current = undefined;
      presenceRef.current?.send({
        type: "broadcast",
        event: "select",
        payload: { user_id: userId, selected: selectedRef.current },
      });
    }, 250);
  }, [userId]);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let retry: number | undefined;
    let stopped = false;

    const connect = () => {
      const current = supabase.channel(`venue-presence:${venueId}`, {
        config: { presence: { key: userId }, broadcast: { self: false } },
      });
      channel = current;
      current
        .on("presence", { event: "sync" }, () => {
          const state = current.presenceState<{ user_id: string; email: string }>();
          setOnline(
            Object.values(state)
              .map((entries) => entries[entries.length - 1])
              .filter(Boolean)
              .map((u) => ({ user_id: u.user_id, email: u.email })),
          );
        })
        .on("presence", { event: "join" }, () => {
          // Tell newcomers what this user has selected.
          if (selectedRef.current) sendSelection();
        })
        .on("broadcast", { event: "select" }, ({ payload }) => {
          const { user_id, selected } = payload as { user_id: string; selected: string | null };
          setSelections((prev) => ({ ...prev, [user_id]: selected }));
        })
        .subscribe(async (status) => {
          if (stopped) return;
          if (status === "SUBSCRIBED") {
            presenceRef.current = current;
            await current.track({ user_id: userId, email });
            if (selectedRef.current) sendSelection();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            presenceRef.current = null;
            supabase.removeChannel(current);
            window.clearTimeout(retry);
            retry = window.setTimeout(() => !stopped && connect(), 10000);
          }
        });
    };
    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retry);
      presenceRef.current = null;
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, venueId, userId, email, sendSelection]);

  const trackSelection = useCallback(
    (selected: string | null) => {
      selectedRef.current = selected;
      sendSelection();
    },
    [sendSelection],
  );

  const onlineWithSelection = useMemo(
    () => online.map((u) => ({ ...u, selected: selections[u.user_id] ?? null })),
    [online, selections],
  );

  // ---------------- Mutations (optimistic, reverted on error) ----------------

  const createFeature = useCallback(
    async (input: { id: string; layerId: string; geometry: FeatureGeometry; mode: string }) => {
      const now = new Date().toISOString();
      const row: FeatureRow & { _local?: boolean } = {
        id: input.id,
        event_id: eventId,
        venue_id: venueId,
        layer_id: input.layerId,
        name: "",
        notes: "",
        geometry: input.geometry,
        properties: { mode: input.mode },
        created_by: userId,
        updated_by: userId,
        created_at: now,
        updated_at: now,
        _local: true,
      };
      setFeatures((list) => upsert(list, row));
      const insert = supabase
        .from("features")
        .insert({
          id: row.id,
          event_id: eventId,
          venue_id: venueId,
          layer_id: row.layer_id,
          geometry: row.geometry,
          properties: row.properties,
          created_by: userId,
        })
        .then((r) => r);
      pendingCreates.current.set(row.id, insert);
      const { error } = await insert;
      pendingCreates.current.delete(row.id);
      if (error) {
        setFeatures((list) => list.filter((r) => r.id !== row.id));
        report(`Could not save the shape: ${error.message}`);
      }
    },
    [supabase, eventId, venueId, userId, report],
  );

  const updateFeature = useCallback(
    async (id: string, patch: Partial<Pick<FeatureRow, "name" | "notes" | "geometry" | "layer_id">>) => {
      let previous: FeatureRow | undefined;
      setFeatures((list) =>
        list.map((r) => {
          if (r.id !== id) return r;
          previous = r;
          return { ...r, ...patch, updated_by: userId, _local: true };
        }),
      );
      await pendingCreates.current.get(id);
      const { error } = await supabase.from("features").update(patch).eq("id", id);
      if (error) {
        if (previous) setFeatures((list) => list.map((r) => (r.id === id ? previous! : r)));
        report(`Could not save the change: ${error.message}`);
      }
    },
    [supabase, userId, report],
  );

  const deleteFeature = useCallback(
    async (id: string) => {
      let previous: FeatureRow | undefined;
      setFeatures((list) => {
        previous = list.find((r) => r.id === id);
        return list.filter((r) => r.id !== id);
      });
      await pendingCreates.current.get(id);
      const { error } = await supabase.from("features").delete().eq("id", id);
      if (error) {
        if (previous) setFeatures((list) => upsert(list, previous!));
        report(`Could not delete: ${error.message}`);
      }
    },
    [supabase, report],
  );

  const createLayer = useCallback(
    async (name: string, color: string) => {
      const sort_order = (layers.at(-1)?.sort_order ?? -1) + 1;
      const { data, error } = await supabase
        .from("layers")
        .insert({ event_id: eventId, venue_id: venueId, name, color, sort_order })
        .select("*")
        .single();
      if (error) return report(`Could not add the layer: ${error.message}`);
      setLayers((list) => upsert(list, data as LayerRow));
      return data as LayerRow;
    },
    [supabase, eventId, venueId, layers, report],
  );

  const updateLayer = useCallback(
    async (id: string, patch: Partial<Pick<LayerRow, "name" | "color">>) => {
      setLayers((list) => list.map((l) => (l.id === id ? { ...l, ...patch } : l)));
      const { error } = await supabase.from("layers").update(patch).eq("id", id);
      if (error) report(`Could not update the layer: ${error.message}`);
    },
    [supabase, report],
  );

  const deleteLayer = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("layers").delete().eq("id", id);
      if (error) return report(`Could not delete the layer: ${error.message}`);
      setLayers((list) => list.filter((l) => l.id !== id));
      setFeatures((list) => list.filter((f) => f.layer_id !== id));
    },
    [supabase, report],
  );

  const addComment = useCallback(
    async (input: { body: string; lng?: number; lat?: number; parentId?: string }) => {
      const { data, error } = await supabase
        .from("comments")
        .insert({
          event_id: eventId,
          venue_id: venueId,
          body: input.body,
          lng: input.parentId ? null : input.lng,
          lat: input.parentId ? null : input.lat,
          parent_id: input.parentId ?? null,
          created_by: userId,
        })
        .select("*")
        .single();
      if (error) return report(`Could not post the comment: ${error.message}`);
      setComments((list) => upsert(list, data as CommentRow));
      return data as CommentRow;
    },
    [supabase, eventId, venueId, userId, report],
  );

  const setCommentResolved = useCallback(
    async (id: string, resolved: boolean) => {
      setComments((list) => list.map((c) => (c.id === id ? { ...c, resolved } : c)));
      const { error } = await supabase.from("comments").update({ resolved }).eq("id", id);
      if (error) report(`Could not update the comment: ${error.message}`);
    },
    [supabase, report],
  );

  const deleteComment = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", id);
      if (error) return report(`Could not delete the comment: ${error.message}`);
      setComments((list) => list.filter((c) => c.id !== id && c.parent_id !== id));
    },
    [supabase, report],
  );

  const uploadPanorama = useCallback(
    async (input: { file: File; title: string; lng: number; lat: number }) => {
      const ext = (input.file.name.split(".").pop() ?? "jpg").toLowerCase();
      const path = `${eventId}/${venueId}/${crypto.randomUUID()}.${ext}`;
      const upload = await supabase.storage
        .from("panoramas")
        .upload(path, input.file, { contentType: input.file.type, upsert: false });
      if (upload.error) return report(`Upload failed: ${upload.error.message}`);
      const { data, error } = await supabase
        .from("panoramas")
        .insert({
          event_id: eventId,
          venue_id: venueId,
          title: input.title,
          lng: input.lng,
          lat: input.lat,
          storage_path: path,
          created_by: userId,
        })
        .select("*")
        .single();
      if (error) {
        await supabase.storage.from("panoramas").remove([path]);
        return report(`Could not save the photo: ${error.message}`);
      }
      setPanoramas((list) => upsert(list, data as PanoramaRow));
      return data as PanoramaRow;
    },
    [supabase, eventId, venueId, userId, report],
  );

  const deletePanorama = useCallback(
    async (row: PanoramaRow) => {
      const { error } = await supabase.from("panoramas").delete().eq("id", row.id);
      if (error) return report(`Could not delete the photo: ${error.message}`);
      await supabase.storage.from("panoramas").remove([row.storage_path]);
      setPanoramas((list) => list.filter((p) => p.id !== row.id));
    },
    [supabase, report],
  );

  const panoramaUrl = useCallback(
    async (row: PanoramaRow) => {
      const { data, error } = await supabase.storage.from("panoramas").createSignedUrl(row.storage_path, 3600);
      if (error) {
        report(`Could not open the photo: ${error.message}`);
        return null;
      }
      return data.signedUrl;
    },
    [supabase, report],
  );

  return {
    loading,
    error,
    connected,
    layers,
    features,
    comments,
    panoramas,
    profiles,
    online: onlineWithSelection,
    report,
    trackSelection,
    createFeature,
    updateFeature,
    deleteFeature,
    createLayer,
    updateLayer,
    deleteLayer,
    addComment,
    setCommentResolved,
    deleteComment,
    uploadPanorama,
    deletePanorama,
    panoramaUrl,
  };
}

export type VenueData = ReturnType<typeof useVenueData>;

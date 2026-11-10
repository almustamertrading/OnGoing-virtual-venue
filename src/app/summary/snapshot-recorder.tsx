"use client";

import { useEffect, useRef } from "react";
import { recordSnapshot } from "./actions";

/** Records this week's snapshot once, after the page has rendered (no writes during rendering). */
export function SnapshotRecorder({ needed }: { needed: boolean }) {
  const done = useRef(false);
  useEffect(() => {
    if (!needed || done.current) return;
    done.current = true;
    void recordSnapshot();
  }, [needed]);
  return null;
}

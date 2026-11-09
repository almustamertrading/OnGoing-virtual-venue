"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  CalendarClock,
  FileText,
  Flag,
  FolderKanban,
  Layers,
  PackageSearch,
  Receipt,
  Send,
  SquareCheck,
  type LucideIcon,
} from "lucide-react";
import { describeWhen, feedItemHref, type FeedSource } from "@/lib/calendar";
import { itemTypeLabel } from "@/lib/calendar-meta";
import type { CalendarFeedItem } from "@/lib/types";

export const SOURCE_ICON: Record<FeedSource, LucideIcon> = {
  event: CalendarClock,
  project: FolderKanban,
  submission: Send,
  milestone: Flag,
  task: SquareCheck,
  phase: Layers,
  proposal: FileText,
  rfq: PackageSearch,
  invoice: Receipt,
};

/** Accessible name of an item: title, type, when, then the project code or proposal reference. */
export function itemName(item: CalendarFeedItem, timeZone: string, extra?: string) {
  const parts = [item.title, itemTypeLabel(item), describeWhen(item, timeZone, { withDate: true })];
  if (item.label) parts.push(item.label);
  if (extra) parts.push(extra);
  return parts.join("، ");
}

/**
 * An item on the calendar: a link to the page that manages it, or, for a custom event, a button
 * that opens the event dialog.
 */
export function ItemLink({
  item,
  timeZone,
  onOpenEvent,
  className,
  extraName,
  children,
}: {
  item: CalendarFeedItem;
  timeZone: string;
  onOpenEvent: (item: CalendarFeedItem) => void;
  className?: string;
  /** Appended to the accessible name (for example the location). */
  extraName?: string;
  children: ReactNode;
}) {
  const name = itemName(item, timeZone, extraName);
  if (item.source === "event") {
    return (
      <button type="button" onClick={() => onOpenEvent(item)} aria-label={name} title={name} className={className}>
        {children}
      </button>
    );
  }
  const href = feedItemHref(item);
  if (!href) {
    return (
      <span title={name} className={className}>
        <span className="sr-only">{name}</span>
        <span aria-hidden>{children}</span>
      </span>
    );
  }
  return (
    <Link href={href} aria-label={name} title={name} className={className}>
      {children}
    </Link>
  );
}

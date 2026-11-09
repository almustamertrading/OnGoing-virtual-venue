import { redirect } from "next/navigation";

// This page never renders UI (it only redirects), so instant-navigation validation does not apply.
export const instant = false;

/** /settings opens the first section. */
export default function SettingsIndexPage() {
  redirect("/settings/account");
}

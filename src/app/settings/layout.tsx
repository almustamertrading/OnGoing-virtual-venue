import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { getMyOrganization } from "@/lib/project";
import { SettingsNav } from "./settings-nav";
import { getSettingsViewer } from "./viewer";

export const metadata = { title: "الإعدادات | OnGoing" };

function Breadcrumbs() {
  return (
    <>
      <Link href="/projects" className="hover:text-white">Projects</Link>
      <ChevronRight size={14} aria-hidden />
      <span className="text-slate-200">Settings</span>
    </>
  );
}

async function HeaderForViewer() {
  const { email } = await getSettingsViewer();
  return (
    <AppHeader email={email}>
      <Breadcrumbs />
    </AppHeader>
  );
}

async function NavForViewer() {
  const org = await getMyOrganization();
  return <SettingsNav isAdmin={Boolean(org?.access.isAdmin)} />;
}

/**
 * Shared settings shell. The session is read only inside the two Suspense boundaries
 * (Cache Components), so the shell and each page's own loading state render immediately.
 */
export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <>
      <Suspense
        fallback={
          <AppHeader>
            <Breadcrumbs />
          </AppHeader>
        }
      >
        <HeaderForViewer />
      </Suspense>
      <div
        dir="rtl"
        lang="ar"
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6 md:flex-row md:items-start md:gap-8"
      >
        <Suspense fallback={<SettingsNav isAdmin={null} />}>
          <NavForViewer />
        </Suspense>
        <main dir="rtl" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </>
  );
}

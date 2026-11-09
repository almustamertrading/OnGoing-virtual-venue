import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { getMyOrganization } from "@/lib/project";
import { templateSections } from "@/lib/proposal-templates";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { ProposalTemplateRow } from "@/lib/types";
import { TemplatesManager } from "./templates-manager";

export const metadata = { title: "قوالب العروض | OnGoing" };

export default async function ProposalTemplatesPage() {
  if (!(await getUserId())) redirect("/login?next=/proposals/templates");
  const org = await getMyOrganization();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const email = (claims?.claims?.email as string | undefined) ?? "";

  const { data } = org
    ? await supabase.from("proposal_templates").select("*").eq("organization_id", org.id).order("name")
    : { data: [] };
  const templates = ((data as ProposalTemplateRow[]) ?? []).map((t) => ({ ...t, sections: templateSections(t.sections) }));

  return (
    <>
      <AppHeader email={email}>
        <Link href="/proposals" className="hover:text-white">Proposals</Link>
        <ChevronRight size={14} />
        <span className="text-slate-200">Templates</span>
      </AppHeader>
      <main dir="rtl" lang="ar" className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-4 py-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">قوالب العروض</h1>
          <p className="text-sm text-slate-400">
            هيكل جاهز لكل نوع عرض: عناوين الأقسام وتوجيه لكل قسم. يبدأ العرض الجديد بأقسام القالب، ويتبع الذكاء الاصطناعي توجيهاته عند التوليد.
          </p>
        </div>
        {org ? (
          <TemplatesManager templates={templates} canEdit={org.access.sales} />
        ) : (
          <p role="status" className="card p-4 text-sm text-slate-300">القوالب متاحة لأعضاء المنظمة.</p>
        )}
      </main>
    </>
  );
}

import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { company } from "@/lib/site-content";

const tajawal = Tajawal({ subsets: ["arabic"], weight: ["400", "500", "700", "800"], variable: "--font-ar" });

export const metadata: Metadata = {
  title: `${company.nameAr} | ${company.nameEn}`,
  description: `${company.legalAr}. ${company.mission}`,
  openGraph: {
    title: `${company.nameAr} — ${company.nameEn}`,
    description: company.tagline,
    locale: "ar_SA",
    type: "website",
  },
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" lang="ar" className={`${tajawal.variable} flex min-h-dvh flex-col bg-[#0a0a0b] font-[family-name:var(--font-ar)] text-stone-200 antialiased`}>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

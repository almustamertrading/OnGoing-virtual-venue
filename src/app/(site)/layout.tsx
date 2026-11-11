import type { Metadata } from "next";
import localFont from "next/font/local";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { company } from "@/lib/site-content";

// Almarai carries the Arabic voice; Archivo stands in for Aktiv Grotesk on the web (Latin + numerals).
// Self-hosted (OFL) so builds never depend on Google Fonts.
const almarai = localFont({
  variable: "--font-ar",
  display: "swap",
  src: [
    { path: "../../fonts/almarai-arabic-300-normal.woff2", weight: "300" },
    { path: "../../fonts/almarai-arabic-400-normal.woff2", weight: "400" },
    { path: "../../fonts/almarai-arabic-700-normal.woff2", weight: "700" },
    { path: "../../fonts/almarai-arabic-800-normal.woff2", weight: "800" },
  ],
});
const archivo = localFont({
  variable: "--font-la",
  display: "swap",
  src: [
    { path: "../../fonts/archivo-latin-400-normal.woff2", weight: "400" },
    { path: "../../fonts/archivo-latin-600-normal.woff2", weight: "600" },
    { path: "../../fonts/archivo-latin-700-normal.woff2", weight: "700" },
  ],
});

export const metadata: Metadata = {
  title: `${company.nameEn} | ${company.legalAr}`,
  description: `${company.legalAr} (${company.nameEn}). ${company.mission}`,
  icons: { icon: "/brand/icon-32.png", apple: "/brand/icon-180.png" },
  openGraph: {
    title: `${company.nameEn} — ${company.tagline}`,
    description: company.taglineEn,
    locale: "ar_SA",
    type: "website",
  },
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" lang="ar" className={`site ${almarai.variable} ${archivo.variable} flex min-h-dvh flex-col bg-ink text-sand antialiased`}>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

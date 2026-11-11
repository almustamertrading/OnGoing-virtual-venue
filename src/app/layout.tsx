import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Platform UI uses the brand's Latin face (Archivo) with Almarai for Arabic text.
const geistSans = localFont({
  variable: "--font-geist-sans",
  display: "swap",
  src: [
    { path: "../fonts/archivo-latin-400-normal.woff2", weight: "400" },
    { path: "../fonts/archivo-latin-600-normal.woff2", weight: "600" },
    { path: "../fonts/archivo-latin-700-normal.woff2", weight: "700" },
    { path: "../fonts/almarai-arabic-400-normal.woff2", weight: "400" },
    { path: "../fonts/almarai-arabic-700-normal.woff2", weight: "700" },
  ],
});
const geistMono = localFont({ variable: "--font-geist-mono", display: "swap", src: "../fonts/geist-mono-latin-400-normal.woff2" });

export const metadata: Metadata = {
  title: "Ongoing Events — Platform",
  description: "Projects, venues, proposals and field work in one place.",
  icons: { icon: "/brand/icon-32.png", apple: "/brand/icon-180.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}

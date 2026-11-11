import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  variable: "--font-geist-sans",
  display: "swap",
  src: [
    { path: "../fonts/geist-sans-latin-400-normal.woff2", weight: "400" },
    { path: "../fonts/geist-sans-latin-500-normal.woff2", weight: "500" },
    { path: "../fonts/geist-sans-latin-600-normal.woff2", weight: "600" },
    { path: "../fonts/geist-sans-latin-700-normal.woff2", weight: "700" },
  ],
});
const geistMono = localFont({ variable: "--font-geist-mono", display: "swap", src: "../fonts/geist-mono-latin-400-normal.woff2" });

export const metadata: Metadata = {
  title: "OnGoing Virtual Venue",
  description: "Run projects, venues and client deliverables in one place.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}

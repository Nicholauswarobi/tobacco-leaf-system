import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/layout/theme-provider";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "TobaccoScan — Tobacco Leaf Disease & Quality Grading",
    template: "%s · TobaccoScan",
  },
  description:
    "AI-driven detection of tobacco leaf diseases and intelligent quality grading for modern agriculture.",
  keywords: [
    "tobacco",
    "leaf disease detection",
    "quality grading",
    "agriculture AI",
    "computer vision",
    "CNN",
  ],
  authors: [{ name: "TobaccoScan" }],
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "TobaccoScan — Tobacco Leaf Diagnostics",
    description: "Detection of tobacco leaf diseases and quality grading powered by deep learning.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f3e9" },
    { media: "(prefers-color-scheme: dark)", color: "#14181b" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${manrope.variable} ${jetbrains.variable}`}
    >
      <body className="font-sans antialiased">
        <ThemeProvider>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}

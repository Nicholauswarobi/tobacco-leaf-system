import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/layout/theme-provider";
import { LanguageProvider } from "@/lib/i18n";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ServiceWorker } from "@/components/pwa/service-worker";
import { InstallBanner } from "@/components/pwa/install-button";

// Headings. A grotesque with open counters reads cleanly at small sizes on a
// phone, where the previous high-contrast serif went spindly.
const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700"],
});

// Body. Inter is designed for screen text at exactly these sizes.
const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
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
    "Photograph a tobacco leaf to find out whether it is sick, what to spray, and what grade it will fetch.",
  keywords: [
    "tobacco",
    "tumbaku",
    "leaf disease",
    "ugonjwa wa majani",
    "quality grading",
    "daraja la ubora",
    "farming",
  ],
  authors: [{ name: "TobaccoScan" }],
  manifest: "/manifest.webmanifest",
  applicationName: "TobaccoScan",
  icons: {
    icon: [
      { url: "/icons/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // iOS ignores the manifest for install behaviour and reads these instead —
  // without them, "Add to Home Screen" opens the app in a Safari tab with the
  // browser chrome still showing.
  appleWebApp: {
    capable: true,
    title: "TobaccoScan",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  other: {
    // `appleWebApp.capable` above emits only the modern
    // `mobile-web-app-capable`, which Safari does not read. iOS before 16.4
    // honours nothing but this deprecated spelling, and without it the app
    // opens inside Safari's chrome instead of full screen. Harmless on newer
    // iOS, which takes `display: standalone` from the manifest.
    "apple-mobile-web-app-capable": "yes",
  },
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
      className={`${display.variable} ${body.variable} ${jetbrains.variable}`}
    >
      <body className="font-sans antialiased">
        <ThemeProvider>
          <LanguageProvider>
            <div className="flex min-h-screen flex-col">
              <Navbar />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
            <ServiceWorker />
            <InstallBanner />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

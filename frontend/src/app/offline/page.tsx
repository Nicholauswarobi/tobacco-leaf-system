import type { Metadata } from "next";

import { OfflineView } from "@/components/pwa/offline-view";

export const metadata: Metadata = {
  title: "Offline",
  description: "TobaccoScan could not reach the network.",
};

/**
 * Served by the service worker when a page is requested with no connection and
 * nothing cached for it. Pages already visited come back from the cache
 * instead, so reaching this one means genuinely new ground.
 */
export default function OfflinePage() {
  return <OfflineView />;
}

import type { Metadata } from "next";

import { AboutView } from "@/components/about/about-view";

export const metadata: Metadata = {
  title: "About",
  description:
    "What TobaccoScan does, how to photograph a leaf, and what the quality grades mean.",
};

export default function AboutPage() {
  return <AboutView />;
}

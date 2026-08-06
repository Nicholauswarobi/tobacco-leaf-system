import type { Metadata } from "next";

import { AnalysisSection } from "@/components/upload/analysis-section";

export const metadata: Metadata = {
  title: "Quality Grade",
  description: "Photograph a cured tobacco leaf to get its quality grade.",
};

export default function QualityGradePage() {
  return <AnalysisSection mode="quality" />;
}

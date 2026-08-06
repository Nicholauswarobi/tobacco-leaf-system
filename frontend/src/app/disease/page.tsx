import type { Metadata } from "next";

import { AnalysisSection } from "@/components/upload/analysis-section";

export const metadata: Metadata = {
  title: "Disease Check",
  description: "Photograph a fresh tobacco leaf to find out whether it is sick.",
};

export default function DiseaseCheckPage() {
  return <AnalysisSection mode="disease" />;
}

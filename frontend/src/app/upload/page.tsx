import type { Metadata } from "next";

import { AnalysisSection } from "@/components/upload/analysis-section";

export const metadata: Metadata = {
  title: "Check a leaf",
  description: "Photograph a tobacco leaf to check it for disease.",
};

/** Kept as a friendly alias for /disease — older links and shortcuts land here. */
export default function UploadPage() {
  return <AnalysisSection mode="disease" />;
}

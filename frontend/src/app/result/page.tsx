import type { Metadata } from "next";
import { ResultView } from "@/components/results/result-view";

export const metadata: Metadata = {
  title: "Diagnosis result",
  description: "Your tobacco leaf diagnosis with disease detection, quality grade, and recommendations.",
};

export default function ResultPage() {
  return <ResultView />;
}

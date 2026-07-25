import type { Metadata } from "next";
import { UploadPanel } from "@/components/upload/upload-panel";

export const metadata: Metadata = {
  title: "Quality Grade",
  description: "Upload a tobacco leaf image for AI-powered quality grading.",
};

export default function QualityGradePage() {
  return (
    <section className="mx-auto max-w-7xl px-5 sm:px-8 py-12 sm:py-16">
      <header className="mb-10 max-w-3xl">
        <p className="text-xs uppercase tracking-[0.18em] text-leaf-700 dark:text-leaf-300">
          Quality Grading
        </p>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight">
          Grade leaf quality.
        </h1>
        <p className="mt-4 text-[var(--fg-muted)] leading-relaxed">
          Upload a clear photo of a cured tobacco leaf to receive a quality grade (Grade A, B, or C) 
          based on color, texture, uniformity, and market readiness. Ensure consistent, natural lighting 
          for accurate assessment.
        </p>
      </header>

      <UploadPanel mode="quality" />
    </section>
  );
}

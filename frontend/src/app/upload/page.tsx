import type { Metadata } from "next";
import { UploadPanel } from "@/components/upload/upload-panel";

export const metadata: Metadata = {
  title: "Analyze a leaf",
  description: "Upload or capture a tobacco leaf image for AI-powered disease detection and quality grading.",
};

export default function UploadPage() {
  return (
    <section className="mx-auto max-w-7xl px-5 sm:px-8 py-12 sm:py-16">
      <header className="mb-10 max-w-3xl">
        <p className="text-xs uppercase tracking-[0.18em] text-leaf-700 dark:text-leaf-300">
          Step 01
        </p>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight">
          Capture or upload a leaf.
        </h1>
        <p className="mt-4 text-[var(--fg-muted)] leading-relaxed">
          For best results, photograph a single leaf in even, natural light
          against a plain background. Hold the camera roughly perpendicular
          to the upper leaf surface and ensure the entire leaf fits in frame.
        </p>
      </header>

      <UploadPanel />
    </section>
  );
}

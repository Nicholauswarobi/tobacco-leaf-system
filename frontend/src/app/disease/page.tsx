import type { Metadata } from "next";
import { UploadPanel } from "@/components/upload/upload-panel";

export const metadata: Metadata = {
  title: "Disease Check",
  description: "Upload a tobacco leaf image for AI-powered disease detection.",
};

export default function DiseaseCheckPage() {
  return (
    <section className="mx-auto max-w-7xl px-5 sm:px-8 py-12 sm:py-16">
      <header className="mb-10 max-w-3xl">
        <p className="text-xs uppercase tracking-[0.18em] text-leaf-700 dark:text-leaf-300">
          Disease Detection
        </p>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight">
          Check for leaf diseases.
        </h1>
        <p className="mt-4 text-[var(--fg-muted)] leading-relaxed">
          Upload a clear photo of a tobacco leaf in natural light to detect Alternaria Leaf Spot, 
          Cercospora Leaf Spot, or identify healthy leaves. Hold the camera roughly perpendicular 
          to the leaf surface and ensure the entire leaf fits in frame.
        </p>
      </header>

      <UploadPanel mode="disease" />
    </section>
  );
}

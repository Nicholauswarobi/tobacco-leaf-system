"use client";

import { UploadPanel } from "@/components/upload/upload-panel";
import { useI18n } from "@/lib/i18n";

/**
 * Page header plus the upload panel, in the reader's language.
 *
 * The disease and quality pages differ only in wording and which model runs,
 * so they share this instead of duplicating the layout.
 */
export function AnalysisSection({ mode }: { mode: "disease" | "quality" }) {
  const { t } = useI18n();
  const prefix = mode === "quality" ? "quality" : "disease";

  return (
    // Tight on a phone, generous on a desktop. The old fixed sizes spent most
    // of a phone screen on the heading, pushing the photo and the button that
    // acts on it below the fold.
    <section className="mx-auto max-w-7xl px-3 sm:px-3 py-2.5 sm:py-5 lg:py-6">
      <header className="mb-3 sm:mb-4 max-w-3xl">
        <p className="text-xs font-semibold tracking-wide text-leaf-700 dark:text-leaf-300">
          {t(`${prefix}.eyebrow` as "disease.eyebrow")}
        </p>
        <h1 className="mt-2 sm:mt-2 font-display text-2xl sm:text-4xl lg:text-5xl tracking-tight">
          {t(`${prefix}.title` as "disease.title")}
        </h1>
        <p className="mt-2 sm:mt-3 text-sm sm:text-base text-[var(--fg-muted)] leading-relaxed">
          {t(`${prefix}.lead` as "disease.lead")}
        </p>
      </header>

      <UploadPanel mode={mode} />
    </section>
  );
}

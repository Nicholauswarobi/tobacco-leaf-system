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
    <section className="mx-auto max-w-7xl px-5 sm:px-8 py-12 sm:py-16">
      <header className="mb-10 max-w-3xl">
        <p className="text-xs uppercase tracking-[0.18em] text-leaf-700 dark:text-leaf-300">
          {t(`${prefix}.eyebrow` as "disease.eyebrow")}
        </p>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight">
          {t(`${prefix}.title` as "disease.title")}
        </h1>
        <p className="mt-4 text-[var(--fg-muted)] leading-relaxed">
          {t(`${prefix}.lead` as "disease.lead")}
        </p>
      </header>

      <UploadPanel mode={mode} />
    </section>
  );
}

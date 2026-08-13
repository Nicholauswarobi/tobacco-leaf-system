"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Leaf,
  Award,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Download,
  Share2,
  Clock,
  Sparkles,
  Info,
  ImagePlus,
  Pill,
} from "lucide-react";
import { motion } from "framer-motion";

import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfidenceBar } from "@/components/results/confidence-bar";
import { api } from "@/lib/api";
import { formatPercent, formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import {
  diseaseName,
  diseaseDescription,
  gradeName,
  gradeDescription,
  marketValue,
  localizeTreatment,
} from "@/lib/leaf-content";
import type { DiseaseTreatment } from "@/types";

const isHealthy = (label: string) => label.toLowerCase() === "healthy";
const gradeTone = (g: string) => {
  if (g.endsWith("A")) return "success" as const;
  if (g.endsWith("B")) return "warning" as const;
  return "danger" as const;
};

export function ResultView() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const latest = useAppStore((s) => s.latest);

  useEffect(() => {
    if (!latest) router.replace("/disease");
  }, [latest, router]);

  if (!latest) {
    return (
      <div className="mx-auto max-w-2xl py-32 text-center">
        <p className="text-[var(--fg-muted)]">{t("common.loading")}</p>
      </div>
    );
  }

  const { disease, quality, image_url, timestamp, processing_time_ms, mode } = latest;
  const healthy = isHealthy(disease.label);

  const showDisease = mode === "disease" || mode === "full";
  const showQuality = mode === "quality" || mode === "full";

  // Send the user back to the section this analysis came from, so uploading
  // again lands in the right model instead of the generic upload page.
  const sameSectionHref = mode === "quality" ? "/quality" : "/disease";
  const sameSectionLabel =
    mode === "quality" ? t("nav.quality") : t("nav.disease");
  const otherSectionHref = mode === "quality" ? "/disease" : "/quality";
  const otherSectionLabel =
    mode === "quality" ? t("nav.disease") : t("nav.quality");

  // Backend content arrives in English; swap it for Swahili when asked.
  const diseaseLabel = diseaseName(disease.label, lang);
  const gradeLabel = gradeName(quality.grade, lang);

  /** Straight back to the same analysis page, ready for the next photo. */
  const analyzeAnother = () => router.push(sameSectionHref);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(latest, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prediction-${latest.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const share = async () => {
    const text =
      mode === "quality"
        ? `${gradeLabel} (${formatPercent(quality.confidence)})`
        : mode === "disease"
        ? `${diseaseLabel} (${formatPercent(disease.confidence)})`
        : `${diseaseLabel} (${formatPercent(disease.confidence)}) · ${gradeLabel} (${formatPercent(quality.confidence)})`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "TobaccoScan diagnosis", text });
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  /* Dynamic page heading */
  const heading =
    mode === "quality" ? (
      <>
        {t("result.gradeIs")}{" "}
        <em className={`${gradeTone(quality.grade) === "success" ? "text-leaf-700 dark:text-leaf-300" : gradeTone(quality.grade) === "warning" ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}>
          {gradeLabel}
        </em>
        .
      </>
    ) : healthy ? (
      <>{t("result.healthy")}</>
    ) : (
      <>
        {t("result.detected")}{" "}
        <em className="text-tobacco-700 dark:text-tobacco-300">{diseaseLabel}</em>.
      </>
    );

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-5 py-6 sm:py-9">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <Link
          href={sameSectionHref}
          className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("result.backTo", { section: sameSectionLabel })}
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={analyzeAnother}>
            <ImagePlus className="h-4 w-4" />
            {t("result.uploadAnother")}
          </Button>
          <Button variant="outline" size="sm" onClick={share}>
            <Share2 className="h-4 w-4" />
            {t("result.share")}
          </Button>
          <Button variant="outline" size="sm" onClick={exportJson}>
            <Download className="h-4 w-4" />
            {t("result.export")}
          </Button>
        </div>
      </div>

      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6"
      >
        <p className="text-xs font-semibold tracking-wide text-leaf-700 dark:text-leaf-300">
          {mode === "quality"
            ? t("result.doneQuality")
            : mode === "disease"
            ? t("result.doneDisease")
            : t("result.doneFull")}
        </p>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight">
          {heading}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--fg-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {formatDate(timestamp)}
          </span>
          <span className="text-[var(--border)]">·</span>
          <span className="font-mono">{processing_time_ms.toFixed(0)} ms</span>
          <span className="text-[var(--border)]">·</span>
          <span className="font-mono">id {latest.id.slice(0, 8)}</span>
        </div>

        {/* Verification passed before any analysis ran — say so, so users know
            the result is about a leaf the system actually recognised. */}
        {latest.verification?.is_tobacco && (
          <div className="mt-4">
            <Badge tone="success">
              <CheckCircle2 className="h-3 w-3" />
              {latest.verification.message}
              {latest.verification.method === "verification_model" && (
                <span className="font-mono opacity-70">
                  {formatPercent(latest.verification.confidence, 0)}
                </span>
              )}
            </Badge>
          </div>
        )}
      </motion.header>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Image preview */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="lg:col-span-5"
        >
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-3 shadow-card sticky top-24">
            <div className="aspect-square w-full overflow-hidden rounded-lg bg-leaf-50 dark:bg-leaf-900/30 relative">
              {image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={api.asset(image_url)}
                  alt="Analyzed leaf"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[var(--fg-muted)]">
                  <Leaf className="h-12 w-12" />
                </div>
              )}
              <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                {showDisease && (
                  <Badge tone={healthy ? "success" : "tobacco"}>
                    {healthy ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    {diseaseLabel}
                  </Badge>
                )}
                {showQuality && (
                  <Badge tone={gradeTone(quality.grade)}>
                    <Award className="h-3 w-3" />
                    {gradeLabel}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right column: results */}
        <div className="lg:col-span-7 space-y-4">

          {/* ── Disease card ── */}
          {showDisease && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-4 sm:p-4 shadow-card"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-wide text-[var(--fg-muted)]">
                    {t("result.diseaseSection")}
                  </p>
                  <h2 className="mt-2 font-display text-2xl sm:text-3xl tracking-tight">
                    {diseaseLabel}
                  </h2>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold tracking-wide text-[var(--fg-muted)]">
                    {t("common.confidence")}
                  </p>
                  <p className="mt-1 font-display text-2xl sm:text-3xl text-leaf-700 dark:text-leaf-300">
                    {formatPercent(disease.confidence, 0)}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm sm:text-base text-[var(--fg-muted)] leading-relaxed">
                {diseaseDescription(disease.label, disease.description, lang)}
              </p>

              <div className="mt-4 grid gap-3">
                {disease.all_probabilities.map((p, i) => (
                  <ConfidenceBar
                    key={p.label}
                    label={diseaseName(p.label, lang)}
                    value={p.probability}
                    highlighted={p.label === disease.label}
                    index={i}
                  />
                ))}
              </div>

              {/* What to do now. Falls back to the plain recommendation list
                  for results saved before treatments were returned. */}
              {disease.treatment ? (
                <TreatmentPanel
                  treatment={localizeTreatment(disease.label, disease.treatment, lang)}
                  healthy={healthy}
                />
              ) : (
                disease.recommendations.length > 0 && (
                  <div className="mt-4 rounded-lg bg-leaf-50 dark:bg-leaf-900/30 border border-leaf-200/60 dark:border-leaf-700/30 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-leaf-700 dark:text-leaf-300" />
                      <h3 className="font-display text-lg">
                        {t("result.recommendations")}
                      </h3>
                    </div>
                    <ul className="space-y-2.5">
                      {disease.recommendations.map((r) => (
                        <li key={r} className="flex items-start gap-2.5 text-sm">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-leaf-700 dark:text-leaf-300 shrink-0" />
                          <span className="text-[var(--fg)]">{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              )}
            </motion.div>
          )}

          {/* ── Quality card ── */}
          {showQuality && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: showDisease ? 0.15 : 0.1 }}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-4 sm:p-4 shadow-card"
            >
              {/*
                Grade and confidence sit on one row; the market-value chip gets
                its own line beneath. It used to live inside the <h2> next to
                the grade, where a phrase as long as "Highest — premium export
                pricing" was squeezed into a narrow column and wrapped to four
                lines inside a pill.
              */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-wide text-[var(--fg-muted)]">
                    {t("result.qualitySection")}
                  </p>
                  <h2 className="mt-2 font-display text-2xl sm:text-3xl tracking-tight">
                    {gradeLabel}
                  </h2>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold tracking-wide text-[var(--fg-muted)]">
                    {t("common.confidence")}
                  </p>
                  <p className="mt-1 font-display text-2xl sm:text-3xl text-tobacco-700 dark:text-tobacco-300">
                    {formatPercent(quality.confidence, 0)}
                  </p>
                </div>
              </div>

              <Badge tone={gradeTone(quality.grade)} className="mt-3">
                <Award className="h-3 w-3 shrink-0" />
                {marketValue(quality.grade, quality.market_value, lang)}
              </Badge>

              <p className="mt-4 text-sm sm:text-base text-[var(--fg-muted)] leading-relaxed">
                {gradeDescription(quality.grade, quality.description, lang)}
              </p>

              <div className="mt-4 grid gap-3">
                {quality.all_probabilities.map((p, i) => (
                  <ConfidenceBar
                    key={p.label}
                    label={gradeName(p.label, lang)}
                    value={p.probability}
                    highlighted={p.label === quality.grade}
                    index={i}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Info banner: no quality model yet (disease-only mode) ── */}
          {mode === "disease" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] px-4 py-4 text-sm text-[var(--fg-muted)]"
            >
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-leaf-700 dark:text-leaf-300" />
              <p>{t("result.noQualityModel")}</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Analyze again ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        className="mt-5 flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h3 className="font-display text-2xl tracking-tight">
            {t("result.againTitle")}
          </h3>
          <p className="mt-1.5 text-sm text-[var(--fg-muted)]">
            {t("result.againBody", { section: sameSectionLabel })}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={analyzeAnother}>
            <ImagePlus className="h-4 w-4" />
            {t("result.againButton", { section: sameSectionLabel })}
          </Button>
          <Button variant="outline" onClick={() => router.push(otherSectionHref)}>
            {t("result.goOther", { section: otherSectionLabel })}
          </Button>
        </div>
      </motion.div>
    </section>
  );
}

/**
 * What to do about the detected disease: the medicine to spray, its rate and
 * interval, and two or three field actions. Kept short on purpose — this is
 * read on a phone in the field, not at a desk.
 */
function TreatmentPanel({
  treatment,
  healthy,
}: {
  treatment: DiseaseTreatment;
  healthy: boolean;
}) {
  const { t } = useI18n();
  const { urgency, summary, medicines, actions, caution } = treatment;

  return (
    <div className="mt-4 rounded-lg border border-leaf-200/60 bg-leaf-50 p-4 dark:border-leaf-700/30 dark:bg-leaf-900/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg">{t("tx.title")}</h3>
        <Badge tone={healthy ? "success" : "warning"}>{urgency}</Badge>
      </div>
      <p className="mt-2 text-sm text-[var(--fg)]">{summary}</p>

      {medicines.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <Pill className="h-4 w-4 text-leaf-700 dark:text-leaf-300" />
            <h4 className="text-xs font-semibold tracking-wide text-[var(--fg-muted)]">
              {t("tx.medicine")}
            </h4>
          </div>
          <ul className="mt-3 space-y-2">
            {medicines.map((m) => (
              <li
                key={m.name}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] px-4 py-3"
              >
                <p className="text-sm font-medium text-[var(--fg)]">{m.name}</p>
                <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
                  {m.dose} · {m.interval}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {actions.length > 0 && (
        <ul className="mt-3 space-y-2">
          {actions.map((a) => (
            <li key={a} className="flex items-start gap-2.5 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-leaf-700 dark:text-leaf-300" />
              <span className="text-[var(--fg)]">{a}</span>
            </li>
          ))}
        </ul>
      )}

      {caution && (
        <p className="mt-3 border-t border-leaf-200/60 pt-3 text-xs text-[var(--fg-muted)] dark:border-leaf-700/30">
          {caution}
        </p>
      )}
    </div>
  );
}

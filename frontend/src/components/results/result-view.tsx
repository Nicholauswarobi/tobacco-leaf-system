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
import type { DiseaseTreatment } from "@/types";

const isHealthy = (label: string) => label.toLowerCase() === "healthy";
const gradeTone = (g: string) => {
  if (g.endsWith("A")) return "success" as const;
  if (g.endsWith("B")) return "warning" as const;
  return "danger" as const;
};

export function ResultView() {
  const router = useRouter();
  const latest = useAppStore((s) => s.latest);

  useEffect(() => {
    if (!latest) router.replace("/upload");
  }, [latest, router]);

  if (!latest) {
    return (
      <div className="mx-auto max-w-2xl py-32 text-center">
        <p className="text-[var(--fg-muted)]">No prediction loaded. Redirecting…</p>
      </div>
    );
  }

  const { disease, quality, image_url, timestamp, processing_time_ms, mode } = latest;
  const healthy = isHealthy(disease.label);

  const showDisease = mode === "disease" || mode === "full";
  const showQuality = mode === "quality" || mode === "full";

  // Send the user back to the section this analysis came from, so uploading
  // again lands in the right model instead of the generic upload page.
  const sameSectionHref =
    mode === "quality" ? "/quality" : mode === "disease" ? "/disease" : "/upload";
  const sameSectionLabel =
    mode === "quality" ? "Quality Grading" : mode === "disease" ? "Disease Detection" : "Full analysis";
  const otherSectionHref = mode === "quality" ? "/disease" : "/quality";
  const otherSectionLabel =
    mode === "quality" ? "Disease Detection" : "Quality Grading";

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
        ? `Tobacco leaf quality: ${quality.grade} (${formatPercent(quality.confidence)})`
        : mode === "disease"
        ? `Tobacco leaf diagnosis: ${disease.label} (${formatPercent(disease.confidence)})`
        : `Tobacco leaf — ${disease.label} (${formatPercent(disease.confidence)}) · ${quality.grade} (${formatPercent(quality.confidence)})`;

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
        Quality grade:{" "}
        <em className={`${gradeTone(quality.grade) === "success" ? "text-leaf-700 dark:text-leaf-300" : gradeTone(quality.grade) === "warning" ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}>
          {quality.grade}
        </em>
        .
      </>
    ) : healthy ? (
      <>
        The leaf reads <em className="text-leaf-700 dark:text-leaf-300">healthy</em>.
      </>
    ) : (
      <>
        We detected <em className="text-tobacco-700 dark:text-tobacco-300">{disease.label}</em>.
      </>
    );

  return (
    <section className="mx-auto max-w-7xl px-5 sm:px-8 py-10 sm:py-14">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <Link
          href={sameSectionHref}
          className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {sameSectionLabel}
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={analyzeAnother}>
            <ImagePlus className="h-4 w-4" />
            Upload another leaf
          </Button>
          <Button variant="outline" size="sm" onClick={share}>
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <Button variant="outline" size="sm" onClick={exportJson}>
            <Download className="h-4 w-4" />
            Export JSON
          </Button>
        </div>
      </div>

      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-10"
      >
        <p className="text-xs uppercase tracking-[0.18em] text-leaf-700 dark:text-leaf-300">
          {mode === "quality" ? "Quality grading complete" : mode === "disease" ? "Disease detection complete" : "Diagnosis complete"}
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

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Image preview */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="lg:col-span-5"
        >
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elev)] p-3 shadow-card sticky top-24">
            <div className="aspect-square w-full overflow-hidden rounded-2xl bg-leaf-50 dark:bg-leaf-900/30 relative">
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
                    {disease.label}
                  </Badge>
                )}
                {showQuality && (
                  <Badge tone={gradeTone(quality.grade)}>
                    <Award className="h-3 w-3" />
                    {quality.grade}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right column: results */}
        <div className="lg:col-span-7 space-y-6">

          {/* ── Disease card ── */}
          {showDisease && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elev)] p-7 shadow-card"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                    Disease detection
                  </p>
                  <h2 className="mt-2 font-display text-3xl tracking-tight">
                    {disease.label}
                  </h2>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                    Confidence
                  </p>
                  <p className="mt-1 font-display text-3xl text-leaf-700 dark:text-leaf-300">
                    {formatPercent(disease.confidence, 0)}
                  </p>
                </div>
              </div>

              <p className="mt-5 text-[var(--fg-muted)] leading-relaxed">
                {disease.description}
              </p>

              <div className="mt-6 grid gap-3">
                {disease.all_probabilities.map((p, i) => (
                  <ConfidenceBar
                    key={p.label}
                    label={p.label}
                    value={p.probability}
                    highlighted={p.label === disease.label}
                    index={i}
                  />
                ))}
              </div>

              {/* What to do now. Falls back to the plain recommendation list
                  for results saved before treatments were returned. */}
              {disease.treatment ? (
                <TreatmentPanel treatment={disease.treatment} healthy={healthy} />
              ) : (
                disease.recommendations.length > 0 && (
                  <div className="mt-7 rounded-2xl bg-leaf-50 dark:bg-leaf-900/30 border border-leaf-200/60 dark:border-leaf-700/30 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-leaf-700 dark:text-leaf-300" />
                      <h3 className="font-display text-lg">Recommendations</h3>
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
              className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elev)] p-7 shadow-card"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                    Quality grade
                  </p>
                  <h2 className="mt-2 font-display text-3xl tracking-tight flex items-center gap-3">
                    {quality.grade}
                    <Badge tone={gradeTone(quality.grade)}>{quality.market_value}</Badge>
                  </h2>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                    Confidence
                  </p>
                  <p className="mt-1 font-display text-3xl text-tobacco-700 dark:text-tobacco-300">
                    {formatPercent(quality.confidence, 0)}
                  </p>
                </div>
              </div>

              <p className="mt-5 text-[var(--fg-muted)] leading-relaxed">
                {quality.description}
              </p>

              <div className="mt-6 grid gap-3">
                {quality.all_probabilities.map((p, i) => (
                  <ConfidenceBar
                    key={p.label}
                    label={p.label}
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
              className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] px-5 py-4 text-sm text-[var(--fg-muted)]"
            >
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-leaf-700 dark:text-leaf-300" />
              <p>
                <strong className="text-[var(--fg)]">Quality grading not available.</strong>{" "}
                No quality model has been trained yet. Use the{" "}
                <Link href="/quality" className="text-leaf-700 dark:text-leaf-300 underline underline-offset-2">
                  Quality Check
                </Link>{" "}
                page once a quality model is ready.
              </p>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Analyze again ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        className="mt-8 flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--bg-elev)] p-7 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h3 className="font-display text-2xl tracking-tight">
            Analyze another leaf
          </h3>
          <p className="mt-1.5 text-sm text-[var(--fg-muted)]">
            Upload the next photo in {sameSectionLabel}, or switch section.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={analyzeAnother}>
            <ImagePlus className="h-4 w-4" />
            Upload in {sameSectionLabel}
          </Button>
          {mode !== "full" && (
            <Button
              variant="outline"
              onClick={() => router.push(otherSectionHref)}
            >
              Go to {otherSectionLabel}
            </Button>
          )}
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
  const { urgency, summary, medicines, actions, caution } = treatment;

  return (
    <div className="mt-7 rounded-2xl border border-leaf-200/60 bg-leaf-50 p-5 dark:border-leaf-700/30 dark:bg-leaf-900/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg">What to do</h3>
        <Badge tone={healthy ? "success" : "warning"}>{urgency}</Badge>
      </div>
      <p className="mt-2 text-sm text-[var(--fg)]">{summary}</p>

      {medicines.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center gap-2">
            <Pill className="h-4 w-4 text-leaf-700 dark:text-leaf-300" />
            <h4 className="text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)]">
              Medicine — use one
            </h4>
          </div>
          <ul className="mt-3 space-y-2">
            {medicines.map((m) => (
              <li
                key={m.name}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] px-4 py-3"
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
        <ul className="mt-5 space-y-2">
          {actions.map((a) => (
            <li key={a} className="flex items-start gap-2.5 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-leaf-700 dark:text-leaf-300" />
              <span className="text-[var(--fg)]">{a}</span>
            </li>
          ))}
        </ul>
      )}

      {caution && (
        <p className="mt-5 border-t border-leaf-200/60 pt-3 text-xs text-[var(--fg-muted)] dark:border-leaf-700/30">
          {caution}
        </p>
      )}
    </div>
  );
}

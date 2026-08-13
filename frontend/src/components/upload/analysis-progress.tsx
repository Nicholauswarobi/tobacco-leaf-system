"use client";

/**
 * What the user watches while a leaf is being checked.
 *
 * The two phases are genuinely different and are shown differently:
 *
 *   sending  — a real percentage, from XMLHttpRequest's upload events. On
 *              mobile data this is the slow part, and a real number is the
 *              difference between "it is working" and "it has frozen".
 *   working  — the server is thinking. No progress exists to report, so the
 *              bar becomes an indeterminate sweep rather than a fake count-up
 *              that stalls at 90%.
 *
 * The step list underneath mirrors the actual backend pipeline: verification
 * runs first and only then does the disease or quality model run.
 */

import { motion } from "framer-motion";
import { Check, Loader2, Upload, ShieldCheck, Microscope } from "lucide-react";

import { useI18n, type TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type AnalysisPhase = "sending" | "working";

interface Props {
  phase: AnalysisPhase;
  /** 0–1, meaningful only while `phase` is "sending". */
  uploaded: number;
  mode: "disease" | "quality";
}

export function AnalysisProgress({ phase, uploaded, mode }: Props) {
  const { t } = useI18n();

  const percent = Math.round(uploaded * 100);
  const sending = phase === "sending";

  const steps: { key: TKey; icon: typeof Upload; done: boolean; active: boolean }[] =
    [
      {
        key: "progress.stepSend",
        icon: Upload,
        done: !sending,
        active: sending,
      },
      {
        key: "progress.stepVerify",
        icon: ShieldCheck,
        done: false,
        active: !sending,
      },
      {
        key: mode === "quality" ? "progress.stepGrade" : "progress.stepDisease",
        icon: Microscope,
        done: false,
        active: !sending,
      },
    ];

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-4 sm:p-5"
    >
      <div className="flex items-center gap-3">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-leaf-700 dark:text-leaf-300" />
        <p className="min-w-0 flex-1 text-sm font-medium text-[var(--fg)]">
          {sending ? t("progress.sending") : t("progress.working")}
        </p>
        {sending && (
          <span className="shrink-0 font-mono text-sm tabular-nums text-[var(--fg-muted)]">
            {percent}%
          </span>
        )}
      </div>

      {/* The track. Determinate while bytes are moving, a sweep afterwards. */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-leaf-100 dark:bg-leaf-900/40">
        {sending ? (
          <div
            className="h-full rounded-full bg-leaf-700 transition-[width] duration-200 ease-out dark:bg-leaf-300"
            style={{ width: `${Math.max(2, percent)}%` }}
          />
        ) : (
          <motion.div
            className="h-full w-1/3 rounded-full bg-leaf-700 dark:bg-leaf-300"
            animate={{ x: ["-100%", "300%"] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>

      <ol className="mt-4 space-y-2">
        {steps.map(({ key, icon: Icon, done, active }) => (
          <li
            key={key}
            className={cn(
              "flex items-center gap-2.5 text-xs sm:text-sm transition-colors",
              done || active ? "text-[var(--fg)]" : "text-[var(--fg-muted)]"
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                done
                  ? "bg-leaf-700 text-parchment dark:bg-leaf-300 dark:text-leaf-900"
                  : active
                    ? "bg-leaf-100 text-leaf-800 dark:bg-leaf-800/60 dark:text-leaf-100"
                    : "bg-[var(--border)] text-[var(--fg-muted)]"
              )}
            >
              {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
            </span>
            <span className="min-w-0">{t(key)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

"use client";

import Link from "next/link";
import {
  Microscope,
  Award,
  FolderClock,
  Camera,
  Sun,
  Crop,
  Layers,
  Sprout,
  AlertTriangle,
  ArrowUpRight,
  Check,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n, type TKey } from "@/lib/i18n";

/**
 * Written for a farmer holding a phone, not for an examiner reading an
 * architecture document. No model names, no framework names, no talk of
 * layers or endpoints — only what the system does and how to use it well.
 */
export function AboutView() {
  const { t } = useI18n();

  const does: { icon: typeof Microscope; title: TKey; body: TKey }[] = [
    { icon: Microscope, title: "about.what1.title", body: "about.what1.body" },
    { icon: Award, title: "about.what2.title", body: "about.what2.body" },
    { icon: FolderClock, title: "about.what3.title", body: "about.what3.body" },
  ];

  const photoTips: { icon: typeof Sun; key: TKey }[] = [
    { icon: Sun, key: "about.how1" },
    { icon: Crop, key: "about.how2" },
    { icon: Camera, key: "about.how3" },
    { icon: Layers, key: "about.how4" },
    { icon: Sprout, key: "about.how5" },
  ];

  const grades: { grade: string; key: TKey; tone: string }[] = [
    {
      grade: "A",
      key: "about.gradeA",
      tone: "bg-leaf-100 text-leaf-900 dark:bg-leaf-800/50 dark:text-leaf-100",
    },
    {
      grade: "B",
      key: "about.gradeB",
      tone: "bg-tobacco-100 text-tobacco-900 dark:bg-tobacco-800/40 dark:text-tobacco-100",
    },
    {
      grade: "C",
      key: "about.gradeC",
      tone: "bg-[var(--border)] text-[var(--fg)]",
    },
  ];

  return (
    <section className="mx-auto max-w-5xl px-5 sm:px-8 py-16 sm:py-24">
      <p className="text-xs uppercase tracking-[0.18em] text-leaf-700 dark:text-leaf-300">
        {t("about.eyebrow")}
      </p>
      <h1 className="mt-3 font-display text-4xl sm:text-6xl tracking-tight leading-[1.05]">
        {t("about.title")}
      </h1>
      <p className="mt-6 max-w-3xl text-lg text-[var(--fg-muted)] leading-relaxed">
        {t("about.lead")}
      </p>

      {/* What it does */}
      <div className="mt-14 grid gap-6 sm:grid-cols-3">
        {does.map((d) => (
          <div
            key={d.title}
            className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-7"
          >
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-leaf-100 text-leaf-700 dark:bg-leaf-800/40 dark:text-leaf-300">
              <d.icon className="h-5 w-5" />
            </div>
            <h2 className="mt-5 font-display text-2xl tracking-tight">
              {t(d.title)}
            </h2>
            <p className="mt-2 text-[var(--fg-muted)] leading-relaxed">
              {t(d.body)}
            </p>
          </div>
        ))}
      </div>

      {/* Taking a good photo */}
      <div className="mt-14 rounded-3xl border border-[var(--border)] bg-[var(--bg-elev)] p-8">
        <h2 className="font-display text-3xl tracking-tight">
          {t("about.howTitle")}
        </h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {photoTips.map((tip) => (
            <li key={tip.key} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-leaf-100 text-leaf-700 dark:bg-leaf-800/40 dark:text-leaf-300">
                <tip.icon className="h-4 w-4" />
              </span>
              <span className="text-[var(--fg)] leading-relaxed">{t(tip.key)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Which section */}
      <div className="mt-14">
        <h2 className="font-display text-3xl tracking-tight">
          {t("about.sectionsTitle")}
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link
            href="/disease"
            className="group rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6 transition-all hover:-translate-y-0.5 hover:shadow-card"
          >
            <p className="font-display text-xl">{t("about.sections1.title")}</p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-leaf-700 dark:text-leaf-300">
              {t("about.sections1.body")}
              <ArrowUpRight className="h-4 w-4" />
            </p>
          </Link>
          <Link
            href="/quality"
            className="group rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6 transition-all hover:-translate-y-0.5 hover:shadow-card"
          >
            <p className="font-display text-xl">{t("about.sections2.title")}</p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-leaf-700 dark:text-leaf-300">
              {t("about.sections2.body")}
              <ArrowUpRight className="h-4 w-4" />
            </p>
          </Link>
        </div>
        <p className="mt-4 flex items-start gap-2 text-sm text-[var(--fg-muted)]">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-leaf-700 dark:text-leaf-300" />
          {t("about.sectionsNote")}
        </p>
      </div>

      {/* Grades */}
      <div className="mt-14">
        <h2 className="font-display text-3xl tracking-tight">
          {t("about.gradesTitle")}
        </h2>
        <div className="mt-6 space-y-3">
          {grades.map((g) => (
            <div
              key={g.grade}
              className="flex items-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-5"
            >
              <span
                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-xl ${g.tone}`}
              >
                {g.grade}
              </span>
              <p className="text-[var(--fg)] leading-relaxed">{t(g.key)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* The one warning that matters */}
      <div className="mt-14 rounded-3xl border border-amber-300 bg-amber-50 p-8 dark:border-amber-800/50 dark:bg-amber-950/20">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-2xl tracking-tight text-amber-900 dark:text-amber-100">
              {t("about.warnTitle")}
            </h2>
            <p className="mt-2 leading-relaxed text-amber-900/90 dark:text-amber-100/90">
              {t("about.warnBody")}
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-14 rounded-3xl bg-leaf-800 px-8 py-14 text-center dark:bg-leaf-200">
        <h2 className="font-display text-3xl tracking-tight text-parchment dark:text-leaf-900 sm:text-4xl">
          {t("about.ctaTitle")}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-leaf-100 dark:text-leaf-800">
          {t("about.ctaBody")}
        </p>
        <div className="mt-8 flex justify-center">
          <Link href="/disease">
            <Button
              size="lg"
              className="bg-parchment text-leaf-900 hover:bg-tobacco-100 dark:bg-leaf-900 dark:text-parchment dark:hover:bg-leaf-800"
            >
              {t("about.ctaButton")}
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

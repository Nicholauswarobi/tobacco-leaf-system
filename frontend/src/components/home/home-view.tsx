"use client";

import Link from "next/link";
import {
  Leaf,
  ScanSearch,
  TrendingUp,
  Pill,
  Sparkles,
  ArrowUpRight,
  Camera,
  CloudUpload,
  ChartBar,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n, type TKey } from "@/lib/i18n";
import { diseaseName } from "@/lib/leaf-content";

const FEATURES: { icon: typeof ScanSearch; title: TKey; body: TKey }[] = [
  { icon: ScanSearch, title: "home.feature1.title", body: "home.feature1.body" },
  { icon: TrendingUp, title: "home.feature2.title", body: "home.feature2.body" },
  { icon: Pill, title: "home.feature3.title", body: "home.feature3.body" },
];

const STEPS: { num: string; icon: typeof Camera; title: TKey; body: TKey }[] = [
  { num: "01", icon: Camera, title: "home.step1.title", body: "home.step1.body" },
  { num: "02", icon: CloudUpload, title: "home.step2.title", body: "home.step2.body" },
  { num: "03", icon: ChartBar, title: "home.step3.title", body: "home.step3.body" },
];

/** The three classes the disease model actually returns today. */
const DETECTED = ["Healthy", "Alternaria Leaf Spot", "Cercospora Leaf Spot"];

export function HomeView() {
  const { t, lang } = useI18n();

  return (
    <>
      {/* ─── HERO ─── */}
      <section className="relative grain overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-60">
          <div className="absolute -top-32 -left-20 h-96 w-96 rounded-full bg-leaf-200/40 blur-3xl dark:bg-leaf-700/20" />
          <div className="absolute -top-10 right-10 h-80 w-80 rounded-full bg-tobacco-200/30 blur-3xl dark:bg-tobacco-700/20" />
        </div>

        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-5 sm:py-24 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7 flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-1 text-xs tracking-wide text-[var(--fg-muted)]">
              <Sparkles className="h-3.5 w-3.5 text-leaf-700 dark:text-leaf-300" />
              {t("home.badge")}
            </div>

            <h1 className="mt-4 font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              {t("home.title1")}
              <span className="block italic text-leaf-700 dark:text-leaf-300">
                {t("home.title2")}
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-lg text-[var(--fg-muted)] leading-relaxed">
              {t("home.lead")}
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/disease">
                <Button size="lg" className="w-full sm:w-auto">
                  {t("home.ctaDisease")}
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/quality">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  {t("home.ctaQuality")}
                </Button>
              </Link>
            </div>

            <dl className="mt-12 grid grid-cols-3 gap-4 border-t border-[var(--border)] pt-5 max-w-lg">
              <div>
                <dt className="text-xs font-semibold tracking-wide text-[var(--fg-muted)]">
                  {t("home.statDiseases")}
                </dt>
                <dd className="mt-1 font-display text-3xl">2</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-wide text-[var(--fg-muted)]">
                  {t("home.statGrades")}
                </dt>
                <dd className="mt-1 font-display text-3xl">3</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-wide text-[var(--fg-muted)]">
                  {t("home.statSpeed")}
                </dt>
                <dd className="mt-1 font-display text-3xl">
                  ~1<span className="text-base">s</span>
                </dd>
              </div>
            </dl>
          </div>

          {/* Hero card — stylized leaf scan */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-4 shadow-card overflow-hidden">
              <div className="absolute top-4 right-4 flex gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-leaf-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-tobacco-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--border)]" />
              </div>

              <div className="aspect-[4/5] rounded-lg overflow-hidden relative bg-gradient-to-br from-leaf-200 via-leaf-100 to-tobacco-100 dark:from-leaf-800/40 dark:via-leaf-700/30 dark:to-tobacco-800/30">
                <svg viewBox="0 0 200 250" className="absolute inset-0 h-full w-full text-leaf-700 dark:text-leaf-300" fill="none">
                  <path
                    d="M100 10 C 50 50, 25 130, 60 200 C 80 230, 90 240, 100 245 C 110 240, 120 230, 140 200 C 175 130, 150 50, 100 10 Z"
                    stroke="currentColor"
                    strokeWidth="1"
                    fill="currentColor"
                    fillOpacity="0.18"
                  />
                  <path d="M100 10 V 245" stroke="currentColor" strokeWidth="1.5" />
                  {[40, 70, 100, 130, 160, 190, 220].map((y, i) => (
                    <g key={i}>
                      <path
                        d={`M100 ${y} C 80 ${y + 5}, 65 ${y + 12}, 55 ${y + 22}`}
                        stroke="currentColor"
                        strokeWidth="0.8"
                        opacity="0.6"
                      />
                      <path
                        d={`M100 ${y} C 120 ${y + 5}, 135 ${y + 12}, 145 ${y + 22}`}
                        stroke="currentColor"
                        strokeWidth="0.8"
                        opacity="0.6"
                      />
                    </g>
                  ))}
                </svg>

                <div className="absolute inset-x-6 top-1/3 h-px bg-leaf-700 dark:bg-leaf-300 shadow-[0_0_24px_rgba(69,104,56,0.6)]" />
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-[var(--fg-muted)]">
                    {t("result.diseaseSection")}
                  </p>
                  <p className="mt-1 font-display text-lg">
                    {diseaseName("Cercospora Leaf Spot", lang)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold tracking-wide text-[var(--fg-muted)]">
                    {t("common.confidence")}
                  </p>
                  <p className="mt-1 font-mono text-lg text-leaf-700 dark:text-leaf-300">
                    94%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── WHAT IT GIVES YOU ─── */}
      <section className="border-y border-[var(--border)] bg-[var(--bg-elev)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-5 py-9 grid gap-4 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-4">
              <div className="shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-leaf-100 text-leaf-700 dark:bg-leaf-800/40 dark:text-leaf-300">
                <f.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-xl">{t(f.title)}</h3>
                <p className="mt-1.5 text-sm text-[var(--fg-muted)] leading-relaxed">
                  {t(f.body)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-5 py-20">
        <div className="flex flex-col items-start sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-leaf-700 dark:text-leaf-300">
              {t("home.stepsEyebrow")}
            </p>
            <h2 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
              {t("home.stepsTitle")}
            </h2>
          </div>
          <Link
            href="/disease"
            className="text-sm font-medium text-leaf-800 dark:text-leaf-200 hover:underline"
          >
            {t("home.stepsTry")} →
          </Link>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.num}
              className="group relative rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-4 transition-all hover:shadow-card hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between">
                <span className="font-mono text-xs text-[var(--fg-muted)] tracking-wider">
                  {s.num}
                </span>
                <s.icon className="h-5 w-5 text-leaf-700 dark:text-leaf-300" />
              </div>
              <h3 className="mt-5 font-display text-2xl">{t(s.title)}</h3>
              <p className="mt-2 text-sm text-[var(--fg-muted)] leading-relaxed">
                {t(s.body)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── WHAT IT LOOKS FOR ─── */}
      <section className="bg-leaf-50 dark:bg-leaf-900/20 border-y border-[var(--border)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-5 py-20">
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="text-xs font-semibold tracking-wide text-leaf-700 dark:text-leaf-300">
                {t("home.detectEyebrow")}
              </p>
              <h2 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
                {t("home.detectTitle")}
              </h2>
              <p className="mt-3 text-[var(--fg-muted)] leading-relaxed">
                {t("home.detectBody")}
              </p>
            </div>

            <div className="lg:col-span-8 grid gap-3 sm:grid-cols-2">
              {DETECTED.map((label, i) => (
                <div
                  key={label}
                  className="flex items-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] px-4 py-4 hover:shadow-soft transition-shadow"
                >
                  <span className="font-mono text-xs text-[var(--fg-muted)]">
                    0{i + 1}
                  </span>
                  <p className="flex-1 font-display text-lg">
                    {diseaseName(label, lang)}
                  </p>
                  <Leaf className="h-4 w-4 text-leaf-700 dark:text-leaf-300" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-5 py-24">
        <div className="relative overflow-hidden rounded-xl bg-leaf-800 dark:bg-leaf-200 px-5 py-10 sm:px-16 sm:py-20 text-center">
          <div className="absolute inset-0 bg-noise opacity-[0.06]" />
          <h2 className="relative font-display text-4xl text-parchment dark:text-leaf-900 sm:text-5xl tracking-tight">
            {t("home.ctaTitle")}
          </h2>
          <p className="relative mt-3 max-w-xl mx-auto text-leaf-100 dark:text-leaf-800">
            {t("home.ctaBody")}
          </p>
          <div className="relative mt-10 flex justify-center">
            <Link href="/disease">
              <Button
                size="lg"
                className="bg-parchment text-leaf-900 hover:bg-tobacco-100 dark:bg-leaf-900 dark:text-parchment dark:hover:bg-leaf-800"
              >
                {t("home.ctaButton")}
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

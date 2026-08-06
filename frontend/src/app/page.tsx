import Link from "next/link";
import {
  Leaf,
  ScanSearch,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  ArrowUpRight,
  Camera,
  CloudUpload,
  ChartBar,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: ScanSearch,
    title: "Disease Detection",
    body: "Identify Alternaria, Cercospora, and Tobacco Mosaic Virus from a single phone photo.",
  },
  {
    icon: TrendingUp,
    title: "Quality Grading",
    body: "Sort leaves into Grade A, B, or C with the consistency of a veteran tobacco buyer.",
  },
  {
    icon: ShieldCheck,
    title: "Field-Tested AI",
    body: "Trained on a curated dataset of cured and uncured tobacco leaves across regions.",
  },
];

const STEPS = [
  { num: "01", icon: Camera, title: "Capture", body: "Snap or upload a clear photo of the leaf in natural light." },
  { num: "02", icon: CloudUpload, title: "Analyze", body: "Our convolutional network inspects color, texture, and lesions." },
  { num: "03", icon: ChartBar, title: "Decide", body: "Read your diagnosis, grade, and farmer-friendly next steps." },
];

const DISEASES = [
  { name: "Healthy", desc: "No visible signs", tone: "leaf" as const },
  { name: "Alternaria", desc: "Concentric brown spots", tone: "tobacco" as const },
  { name: "Cercospora", desc: "Frog-eye lesions", tone: "tobacco" as const },
  { name: "Mosaic Virus", desc: "Mottled curling", tone: "tobacco" as const },
];

export default function Home() {
  return (
    <>
      {/* ─── HERO ─── */}
      <section className="relative grain overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-60">
          <div className="absolute -top-32 -left-20 h-96 w-96 rounded-full bg-leaf-200/40 blur-3xl dark:bg-leaf-700/20" />
          <div className="absolute -top-10 right-10 h-80 w-80 rounded-full bg-tobacco-200/30 blur-3xl dark:bg-tobacco-700/20" />
        </div>

        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7 flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-1 text-xs tracking-wide text-[var(--fg-muted)]">
              <Sparkles className="h-3.5 w-3.5 text-leaf-700 dark:text-leaf-300" />
              CNN-powered tobacco diagnostics
            </div>

            <h1 className="mt-6 font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Read the leaf.
              <span className="block italic text-leaf-700 dark:text-leaf-300">
                Know the harvest.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg text-[var(--fg-muted)] leading-relaxed">
              TobaccoScan combines deep learning with decades of curing wisdom to
              detect disease and grade tobacco leaves in seconds — straight
              from your phone, in any field.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/disease">
                <Button size="lg" className="w-full sm:w-auto">
                  Check diseases
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/quality">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Grade quality
                </Button>
              </Link>
            </div>

            <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-[var(--border)] pt-8 max-w-lg">
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)]">Diseases</dt>
                <dd className="mt-1 font-display text-3xl">4</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)]">Grades</dt>
                <dd className="mt-1 font-display text-3xl">3</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)]">Latency</dt>
                <dd className="mt-1 font-display text-3xl">~1<span className="text-base">s</span></dd>
              </div>
            </dl>
          </div>

          {/* Hero card — stylized leaf scan */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-3xl border border-[var(--border)] bg-[var(--bg-elev)] p-6 shadow-card overflow-hidden">
              <div className="absolute top-4 right-4 flex gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-leaf-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-tobacco-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--border)]" />
              </div>

              <div className="aspect-[4/5] rounded-2xl overflow-hidden relative bg-gradient-to-br from-leaf-200 via-leaf-100 to-tobacco-100 dark:from-leaf-800/40 dark:via-leaf-700/30 dark:to-tobacco-800/30">
                {/* SVG leaf illustration */}
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

                {/* Scanning line animation */}
                <div className="absolute inset-x-6 top-1/3 h-px bg-leaf-700 dark:bg-leaf-300 shadow-[0_0_24px_rgba(69,104,56,0.6)]" />

                {/* Detection annotations */}
                <div className="absolute top-[28%] left-[22%] flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-tobacco-500 animate-pulse" />
                  <span className="rounded-md bg-[var(--bg-elev)] px-2 py-0.5 text-[10px] font-mono shadow-sm">
                    lesion · 0.91
                  </span>
                </div>
                <div className="absolute bottom-[22%] right-[18%] flex items-center gap-2">
                  <span className="rounded-md bg-[var(--bg-elev)] px-2 py-0.5 text-[10px] font-mono shadow-sm">
                    grade A · 0.87
                  </span>
                  <span className="h-2 w-2 rounded-full bg-leaf-600 animate-pulse" />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                    Specimen #4129
                  </p>
                  <p className="mt-1 font-display text-lg">Cercospora detected</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)]">Confidence</p>
                  <p className="mt-1 font-mono text-lg text-leaf-700 dark:text-leaf-300">94.3%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURE STRIP ─── */}
      <section className="border-y border-[var(--border)] bg-[var(--bg-elev)]">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 py-14 grid gap-8 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-4">
              <div className="shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-leaf-100 text-leaf-700 dark:bg-leaf-800/40 dark:text-leaf-300">
                <f.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-xl">{f.title}</h3>
                <p className="mt-1.5 text-sm text-[var(--fg-muted)] leading-relaxed">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="mx-auto max-w-7xl px-5 sm:px-8 py-20">
        <div className="flex flex-col items-start sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-leaf-700 dark:text-leaf-300">
              The workflow
            </p>
            <h2 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
              Three steps from leaf to ledger.
            </h2>
          </div>
          <Link
            href="/upload"
            className="text-sm font-medium text-leaf-800 dark:text-leaf-200 hover:underline"
          >
            Try it now →
          </Link>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.num}
              className="group relative rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-7 transition-all hover:shadow-card hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between">
                <span className="font-mono text-xs text-[var(--fg-muted)] tracking-wider">
                  {s.num}
                </span>
                <s.icon className="h-5 w-5 text-leaf-700 dark:text-leaf-300" />
              </div>
              <h3 className="mt-8 font-display text-2xl">{s.title}</h3>
              <p className="mt-2 text-sm text-[var(--fg-muted)] leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── DISEASE LEGEND ─── */}
      <section className="bg-leaf-50 dark:bg-leaf-900/20 border-y border-[var(--border)]">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 py-20">
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="text-xs uppercase tracking-[0.18em] text-leaf-700 dark:text-leaf-300">
                What we detect
              </p>
              <h2 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
                A trained eye for every leaf.
              </h2>
              <p className="mt-5 text-[var(--fg-muted)] leading-relaxed">
                The model has been calibrated against the most common
                pathologies that affect tobacco yields and downstream curing
                quality.
              </p>
            </div>

            <div className="lg:col-span-8 grid gap-3 sm:grid-cols-2">
              {DISEASES.map((d, i) => (
                <div
                  key={d.name}
                  className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] px-5 py-4 hover:shadow-soft transition-shadow"
                >
                  <span className="font-mono text-xs text-[var(--fg-muted)]">
                    0{i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-display text-lg">{d.name}</p>
                    <p className="text-xs text-[var(--fg-muted)]">{d.desc}</p>
                  </div>
                  <Leaf className="h-4 w-4 text-leaf-700 dark:text-leaf-300" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="mx-auto max-w-7xl px-5 sm:px-8 py-24">
        <div className="relative overflow-hidden rounded-3xl bg-leaf-800 dark:bg-leaf-200 px-8 py-16 sm:px-16 sm:py-20 text-center">
          <div className="absolute inset-0 bg-noise opacity-[0.06]" />
          <h2 className="relative font-display text-4xl text-parchment dark:text-leaf-900 sm:text-5xl tracking-tight">
            Bring intelligence to the curing barn.
          </h2>
          <p className="relative mt-5 max-w-xl mx-auto text-leaf-100 dark:text-leaf-800">
            Upload your first leaf and get a complete diagnosis with
            recommendations in under a second.
          </p>
          <div className="relative mt-10 flex justify-center">
            <Link href="/upload">
              <Button
                size="lg"
                className="bg-parchment text-leaf-900 hover:bg-tobacco-100 dark:bg-leaf-900 dark:text-parchment dark:hover:bg-leaf-800"
              >
                Analyze your first leaf
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

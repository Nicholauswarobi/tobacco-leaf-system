import type { Metadata } from "next";
import Link from "next/link";
import {
  Brain,
  Database,
  Layers,
  ShieldCheck,
  ArrowUpRight,
  Sprout,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About",
  description: "How TobaccoScan detects tobacco leaf diseases and grades quality using deep learning.",
};

const PIPELINE = [
  {
    icon: Database,
    title: "Curated dataset",
    body:
      "Thousands of tobacco leaf images spanning four pathologies and three quality grades, balanced across regions and curing methods.",
  },
  {
    icon: Layers,
    title: "CNN architecture",
    body:
      "MobileNetV2 transfer learning with custom heads. Input is a 224×224 RGB image; output is two softmax distributions — disease and grade.",
  },
  {
    icon: Brain,
    title: "Augmentation",
    body:
      "Random flips, rotations, zoom, brightness, and contrast keep the model robust to real-field variation in lighting and orientation.",
  },
  {
    icon: ShieldCheck,
    title: "Validation",
    body:
      "Held-out validation split with confusion matrix, precision, recall, and F1 reporting on every training run.",
  },
];

export default function AboutPage() {
  return (
    <section className="mx-auto max-w-5xl px-5 sm:px-8 py-16 sm:py-24">
      <p className="text-xs uppercase tracking-[0.18em] text-leaf-700 dark:text-leaf-300">
        About
      </p>
      <h1 className="mt-3 font-display text-4xl sm:text-6xl tracking-tight leading-[1.05]">
        A field-grade model,
        <span className="block italic text-leaf-700 dark:text-leaf-300">
          built for tobacco growers.
        </span>
      </h1>
      <p className="mt-6 text-lg text-[var(--fg-muted)] leading-relaxed max-w-3xl">
        TobaccoScan is a complete diagnostic system that pairs computer vision
        with the operational realities of tobacco farming. It runs on
        commodity hardware, returns answers in under a second, and is
        designed to be useful in the barn, not just the lab.
      </p>

      <div className="mt-16 grid gap-6 sm:grid-cols-2">
        {PIPELINE.map((p) => (
          <div
            key={p.title}
            className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-7"
          >
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-leaf-100 text-leaf-700 dark:bg-leaf-800/40 dark:text-leaf-300">
              <p.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-5 font-display text-2xl tracking-tight">
              {p.title}
            </h3>
            <p className="mt-2 text-[var(--fg-muted)] leading-relaxed">
              {p.body}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-16 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-7">
          <h2 className="font-display text-3xl tracking-tight">
            Open architecture
          </h2>
          <p className="mt-4 text-[var(--fg-muted)] leading-relaxed">
            The system has three independent layers — a Next.js frontend, a
            FastAPI backend, and a Keras/TensorFlow model. Each can be
            swapped or scaled independently. The API contract is documented
            via OpenAPI at <code className="font-mono text-sm text-leaf-700 dark:text-leaf-300">/docs</code>.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3 text-sm">
            {[
              ["Frontend", "Next.js 15 · TS"],
              ["Backend", "FastAPI · Pydantic"],
              ["Model", "TF / Keras"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-[var(--border)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                  {k}
                </p>
                <p className="mt-1 font-display text-lg">{v}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-leaf-200 bg-leaf-50 p-7 dark:border-leaf-800/40 dark:bg-leaf-900/20">
          <Sprout className="h-6 w-6 text-leaf-700 dark:text-leaf-300" />
          <h3 className="mt-3 font-display text-2xl tracking-tight">
            Try it now
          </h3>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">
            Upload a single leaf and get a complete diagnosis with
            recommendations.
          </p>
          <Link href="/upload" className="mt-5 block">
            <Button className="w-full">
              Analyze a leaf
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Leaf,
  Award,
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import Link from "next/link";

import { api } from "@/lib/api";
import type { HistoryItem } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConnectionError } from "@/components/ui/connection-error";
import { formatDate, formatPercent } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { diseaseName, gradeName } from "@/lib/leaf-content";

const DISEASE_COLORS: Record<string, string> = {
  Healthy: "#5d834a",
  "Alternaria Leaf Spot": "#9a763a",
  "Cercospora Leaf Spot": "#b89249",
  "Tobacco Mosaic Virus": "#7c5d2f",
};

const GRADE_COLORS: Record<string, string> = {
  "Grade A": "#456838",
  "Grade B": "#cdaf6b",
  "Grade C": "#b8493e",
};

interface DashboardData {
  items: HistoryItem[];
  total: number;
  diseaseCounts: Record<string, number>;
  gradeCounts: Record<string, number>;
  healthyRate: number;
  avgConfidence: number;
}

export function DashboardView() {
  const { t, lang } = useI18n();
  const [data, setData] = useState<DashboardData | null>(null);
  // Starts true so the first paint is a skeleton rather than a grid of dashes
  // that looks like a real (empty) answer.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.history(200);

      const diseaseCounts: Record<string, number> = {};
      const gradeCounts: Record<string, number> = {};
      let confSum = 0;
      let healthy = 0;

      for (const it of res.items) {
        // A disease-only scan has no real grade, and a quality-only scan has no
        // real diagnosis. Counting the placeholders would invent data.
        if (it.mode !== "quality") {
          diseaseCounts[it.disease_label] = (diseaseCounts[it.disease_label] ?? 0) + 1;
          if (it.disease_label === "Healthy") healthy++;
        }
        if (it.mode !== "disease") {
          gradeCounts[it.quality_grade] = (gradeCounts[it.quality_grade] ?? 0) + 1;
        }
        confSum +=
          it.mode === "quality" ? it.quality_confidence : it.disease_confidence;
      }

      const diagnosed = Object.values(diseaseCounts).reduce((s, n) => s + n, 0);
      const total = res.items.length;

      setData({
        items: res.items,
        total: res.total,
        diseaseCounts,
        gradeCounts,
        healthyRate: diagnosed ? healthy / diagnosed : 0,
        avgConfidence: total ? confSum / total : 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = [
    {
      icon: Activity,
      label: t("dash.total"),
      value: data ? data.total.toString() : ": ",
    },
    {
      icon: Leaf,
      label: t("dash.healthy"),
      value: data ? formatPercent(data.healthyRate, 0) : ", ",
    },
    {
      icon: Award,
      label: t("dash.confidence"),
      value: data ? formatPercent(data.avgConfidence, 0) : ", ",
    },
    {
      icon: AlertTriangle,
      label: t("dash.diseased"),
      value: data
        ? Object.entries(data.diseaseCounts)
            .filter(([k]) => k !== "Healthy")
            .reduce((s, [, n]) => s + n, 0)
            .toString()
        : ": ",
    },
  ];

  const diseaseChart = data
    ? Object.entries(data.diseaseCounts).map(([name, count]) => ({
        name: diseaseName(name, lang).replace(" Leaf Spot", ""),
        count,
        full: name,
      }))
    : [];

  const gradeChart = data
    ? Object.entries(data.gradeCounts).map(([name, value]) => ({
        name: gradeName(name, lang),
        value,
        full: name,
      }))
    : [];

  return (
    <section className="mx-auto max-w-7xl px-3 sm:px-3 py-5 sm:py-6">
      <header className="flex flex-wrap items-end justify-between gap-2.5 mb-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-leaf-700 dark:text-leaf-300">
            {t("dash.eyebrow")}
          </p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl tracking-tight">
            {t("dash.title")}
          </h1>
          <p className="mt-2 text-[var(--fg-muted)] max-w-xl">{t("dash.lead")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {t("common.refresh")}
          </Button>
          <Link href="/disease">
            <Button>
              {t("common.newAnalysis")}
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      {error ? (
        <ConnectionError
          title={t("dash.loadFailed")}
          body={t("common.noConnectionHelp")}
          retry={t("common.retry")}
          onRetry={() => void load()}
        />
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 mb-3">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded border border-[var(--border)] bg-[var(--bg-elev)] p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-wide text-[var(--fg-muted)]">
                    {s.label}
                  </span>
                  <s.icon className="h-4 w-4 text-leaf-700 dark:text-leaf-300" />
                </div>
                {loading ? (
                  <div className="mt-3 h-7 w-16 animate-pulse rounded bg-[var(--border)]" />
                ) : (
                  <p className="mt-2 font-display text-3xl tracking-tight">
                    {s.value}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid gap-2.5 lg:grid-cols-5 mb-3">
            <div className="rounded border border-[var(--border)] bg-[var(--bg-elev)] p-3 lg:col-span-3">
              <h3 className="font-display text-xl tracking-tight">
                {t("dash.diseaseChart")}
              </h3>
              <p className="text-sm text-[var(--fg-muted)]">
                {t("dash.diseaseChartSub")}
              </p>
              <div className="mt-3 h-72">
                {loading ? (
                  <ChartSkeleton />
                ) : diseaseChart.length === 0 ? (
                  <EmptyChart label={t("dash.noData")} />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={diseaseChart} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fill: "var(--fg-muted)", fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fill: "var(--fg-muted)", fontSize: 12 }} />
                      <ReTooltip
                        contentStyle={{
                          background: "var(--bg-elev)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {diseaseChart.map((entry) => (
                          <Cell key={entry.full} fill={DISEASE_COLORS[entry.full] || "#5d834a"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded border border-[var(--border)] bg-[var(--bg-elev)] p-3 lg:col-span-2">
              <h3 className="font-display text-xl tracking-tight">
                {t("dash.gradeChart")}
              </h3>
              <p className="text-sm text-[var(--fg-muted)]">
                {t("dash.gradeChartSub")}
              </p>
              <div className="mt-3 h-72">
                {loading ? (
                  <ChartSkeleton />
                ) : gradeChart.length === 0 ? (
                  <EmptyChart label={t("dash.noData")} />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={gradeChart}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={3}
                      >
                        {gradeChart.map((e) => (
                          <Cell key={e.full} fill={GRADE_COLORS[e.full] || "#5d834a"} />
                        ))}
                      </Pie>
                      <Legend
                        iconType="circle"
                        wrapperStyle={{ fontSize: 12, color: "var(--fg-muted)" }}
                      />
                      <ReTooltip
                        contentStyle={{
                          background: "var(--bg-elev)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Recent activity */}
          <div className="rounded border border-[var(--border)] bg-[var(--bg-elev)] overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-[var(--border)]">
              <h3 className="font-display text-xl tracking-tight">
                {t("dash.recent")}
              </h3>
              <Link
                href="/history"
                className="text-sm text-leaf-700 dark:text-leaf-300 hover:underline"
              >
                {t("dash.viewAll")} →
              </Link>
            </div>

            {loading ? (
              <div className="divide-y divide-[var(--border)]">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2.5">
                    <div className="h-10 w-10 shrink-0 animate-pulse rounded-sm bg-[var(--border)]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-40 animate-pulse rounded bg-[var(--border)]" />
                      <div className="h-3 w-24 animate-pulse rounded bg-[var(--border)]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : data?.items?.length ? (
              <div className="divide-y divide-[var(--border)]">
                {data.items.slice(0, 8).map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between gap-2.5 px-3 py-2.5 hover:bg-leaf-50/40 dark:hover:bg-leaf-900/20 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {it.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={api.asset(it.image_url)}
                          alt=""
                          className="h-10 w-10 rounded-sm object-cover bg-leaf-100"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-sm bg-leaf-100 dark:bg-leaf-800/40 flex items-center justify-center">
                          <Leaf className="h-4 w-4 text-leaf-700 dark:text-leaf-300" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {it.mode === "quality"
                            ? gradeName(it.quality_grade, lang)
                            : diseaseName(it.disease_label, lang)}
                        </p>
                        <p className="text-xs text-[var(--fg-muted)] truncate">
                          {formatDate(it.timestamp)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {it.mode !== "disease" && (
                        <Badge tone="leaf">{gradeName(it.quality_grade, lang)}</Badge>
                      )}
                      <span className="font-mono text-xs tabular-nums text-[var(--fg-muted)]">
                        {formatPercent(
                          it.mode === "quality"
                            ? it.quality_confidence
                            : it.disease_confidence,
                          0
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-[var(--fg-muted)]">
                <Leaf className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{t("dash.empty")}</p>
                <Link
                  href="/disease"
                  className="mt-3 inline-block text-leaf-700 dark:text-leaf-300 hover:underline"
                >
                  {t("dash.emptyCta")} →
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex h-full items-end gap-2 px-2 pb-3">
      {[60, 85, 45, 70].map((h, i) => (
        <div
          key={i}
          className="flex-1 animate-pulse rounded-t-md bg-[var(--border)]"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-full flex items-center justify-center text-sm text-[var(--fg-muted)]">
      {label}
    </div>
  );
}

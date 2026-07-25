"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Leaf,
  Award,
  AlertTriangle,
  ArrowUpRight,
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
import { formatDate, formatPercent } from "@/lib/utils";

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
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.history(200);
        if (cancelled) return;

        const diseaseCounts: Record<string, number> = {};
        const gradeCounts: Record<string, number> = {};
        let confSum = 0;
        let healthy = 0;

        for (const it of res.items) {
          diseaseCounts[it.disease_label] = (diseaseCounts[it.disease_label] ?? 0) + 1;
          gradeCounts[it.quality_grade] = (gradeCounts[it.quality_grade] ?? 0) + 1;
          confSum += (it.disease_confidence + it.quality_confidence) / 2;
          if (it.disease_label === "Healthy") healthy++;
        }

        const total = res.items.length;
        setData({
          items: res.items,
          total: res.total,
          diseaseCounts,
          gradeCounts,
          healthyRate: total ? healthy / total : 0,
          avgConfidence: total ? confSum / total : 0,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-20 text-center">
        <p className="text-[var(--fg-muted)]">
          Could not reach the API. Make sure the backend is running on port 8000.
        </p>
        <p className="mt-2 text-xs font-mono text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  const stats = [
    {
      icon: Activity,
      label: "Total scans",
      value: data ? data.total.toString() : "—",
    },
    {
      icon: Leaf,
      label: "Healthy rate",
      value: data ? formatPercent(data.healthyRate, 0) : "—",
    },
    {
      icon: Award,
      label: "Avg confidence",
      value: data ? formatPercent(data.avgConfidence, 1) : "—",
    },
    {
      icon: AlertTriangle,
      label: "Diseases found",
      value: data
        ? Object.entries(data.diseaseCounts)
            .filter(([k]) => k !== "Healthy")
            .reduce((s, [, n]) => s + n, 0)
            .toString()
        : "—",
    },
  ];

  const diseaseChart = data
    ? Object.entries(data.diseaseCounts).map(([name, count]) => ({
        name: name.replace(" Leaf Spot", ""),
        count,
        full: name,
      }))
    : [];

  const gradeChart = data
    ? Object.entries(data.gradeCounts).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <section className="mx-auto max-w-7xl px-5 sm:px-8 py-12 sm:py-16">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-10">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-leaf-700 dark:text-leaf-300">
            Operations
          </p>
          <h1 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight">
            Field dashboard
          </h1>
          <p className="mt-3 text-[var(--fg-muted)] max-w-xl">
            A live view of every leaf you've analyzed. Spot disease pressure,
            track grade distribution, and audit predictions.
          </p>
        </div>
        <Link
          href="/upload"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-leaf-700 px-5 text-sm font-medium text-parchment hover:bg-leaf-800 dark:bg-leaf-300 dark:text-leaf-900 dark:hover:bg-leaf-200"
        >
          New analysis
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </header>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                {s.label}
              </span>
              <s.icon className="h-4 w-4 text-leaf-700 dark:text-leaf-300" />
            </div>
            <p className="mt-3 font-display text-3xl tracking-tight">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-5 mb-8">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6 lg:col-span-3">
          <h3 className="font-display text-xl tracking-tight">
            Disease distribution
          </h3>
          <p className="text-sm text-[var(--fg-muted)]">
            Counts of each diagnosis across all scans
          </p>
          <div className="mt-6 h-72">
            {diseaseChart.length === 0 ? (
              <EmptyChart />
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

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6 lg:col-span-2">
          <h3 className="font-display text-xl tracking-tight">Grade mix</h3>
          <p className="text-sm text-[var(--fg-muted)]">
            Quality grade breakdown
          </p>
          <div className="mt-6 h-72">
            {gradeChart.length === 0 ? (
              <EmptyChart />
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
                      <Cell key={e.name} fill={GRADE_COLORS[e.name] || "#5d834a"} />
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
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <h3 className="font-display text-xl tracking-tight">Recent activity</h3>
          <Link
            href="/history"
            className="text-sm text-leaf-700 dark:text-leaf-300 hover:underline"
          >
            View full history →
          </Link>
        </div>
        {data?.items?.length ? (
          <div className="divide-y divide-[var(--border)]">
            {data.items.slice(0, 8).map((it) => (
              <div
                key={it.id}
                className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-leaf-50/40 dark:hover:bg-leaf-900/20 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {it.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={api.asset(it.image_url)}
                      alt=""
                      className="h-10 w-10 rounded-lg object-cover bg-leaf-100"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-leaf-100 dark:bg-leaf-800/40 flex items-center justify-center">
                      <Leaf className="h-4 w-4 text-leaf-700 dark:text-leaf-300" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{it.disease_label}</p>
                    <p className="text-xs text-[var(--fg-muted)] truncate">
                      {formatDate(it.timestamp)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge tone="leaf">{it.quality_grade}</Badge>
                  <span className="font-mono text-xs tabular-nums text-[var(--fg-muted)]">
                    {formatPercent(it.disease_confidence, 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-[var(--fg-muted)]">
            <Leaf className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>No predictions yet. Run your first analysis.</p>
            <Link
              href="/upload"
              className="mt-4 inline-block text-leaf-700 dark:text-leaf-300 hover:underline"
            >
              Get started →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function EmptyChart() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-[var(--fg-muted)]">
      No data yet.
    </div>
  );
}

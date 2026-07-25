"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2, Download, Leaf, Search, Microscope, Award } from "lucide-react";

import { api } from "@/lib/api";
import type { HistoryItem } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatPercent } from "@/lib/utils";

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<"all" | "disease" | "quality" | "full">("all");

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.history(200);
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this prediction from history?")) return;
    try {
      await api.deleteHistory(id);
      setItems((arr) => arr.filter((x) => x.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const filtered = items.filter((it) => {
    if (modeFilter !== "all" && it.mode !== modeFilter) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      it.disease_label.toLowerCase().includes(q) ||
      it.quality_grade.toLowerCase().includes(q) ||
      it.id.toLowerCase().includes(q)
    );
  });

  const modeLabel = (mode: HistoryItem["mode"]) => {
    if (mode === "quality") return "Quality";
    if (mode === "full") return "Full";
    return "Disease";
  };

  const modeTone = (mode: HistoryItem["mode"]) => {
    if (mode === "quality") return "tobacco" as const;
    if (mode === "full") return "neutral" as const;
    return "success" as const;
  };

  return (
    <section className="mx-auto max-w-7xl px-5 sm:px-8 py-12 sm:py-16">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-leaf-700 dark:text-leaf-300">
            Records
          </p>
          <h1 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight">
            Prediction history
          </h1>
          <p className="mt-3 text-[var(--fg-muted)] max-w-xl">
            Every scan is preserved here. Search, filter by type, and export to CSV
            for record-keeping or downstream analysis.
          </p>
        </div>
        <div className="flex gap-2">
          <a href={api.exportCsvUrl()} download>
            <Button variant="outline">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </a>
          <Link href="/upload">
            <Button>New analysis</Button>
          </Link>
        </div>
      </header>

      {/* Search + filter row */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
          <input
            type="search"
            placeholder="Filter by disease, grade, or ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-11 pl-11 pr-4 rounded-full border border-[var(--border)] bg-[var(--bg-elev)] text-sm placeholder:text-[var(--fg-muted)] focus:outline-none focus:border-leaf-600"
          />
        </div>
        {/* Mode filter pills */}
        <div className="flex gap-2 items-center">
          {(["all", "disease", "quality", "full"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setModeFilter(m)}
              className={`px-4 py-2 rounded-full text-xs font-medium border transition-colors ${
                modeFilter === m
                  ? "bg-leaf-700 text-white border-leaf-700"
                  : "border-[var(--border)] text-[var(--fg-muted)] hover:border-leaf-600 hover:text-[var(--fg)]"
              }`}
            >
              {m === "all" ? "All" : m === "disease" ? "Disease" : m === "quality" ? "Quality" : "Full"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-[var(--fg-muted)]">Loading…</div>
        ) : error ? (
          <div className="p-12 text-center">
            <p className="text-[var(--fg-muted)]">Could not reach the API.</p>
            <p className="mt-2 text-xs font-mono text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Leaf className="h-8 w-8 mx-auto mb-3 text-[var(--fg-muted)] opacity-50" />
            <p className="text-[var(--fg-muted)]">
              {items.length === 0 ? "No predictions yet." : "No results match your search."}
            </p>
            {items.length === 0 && (
              <Link href="/upload" className="mt-3 inline-block text-leaf-700 dark:text-leaf-300 hover:underline">
                Run your first analysis →
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-leaf-50 dark:bg-leaf-900/20 text-xs uppercase tracking-[0.12em] text-[var(--fg-muted)]">
                <tr>
                  <th className="text-left px-6 py-3 font-medium">Leaf</th>
                  <th className="text-left px-6 py-3 font-medium">Type</th>
                  <th className="text-left px-6 py-3 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Microscope className="h-3.5 w-3.5" /> Disease
                    </span>
                  </th>
                  <th className="text-left px-6 py-3 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Award className="h-3.5 w-3.5" /> Grade
                    </span>
                  </th>
                  <th className="text-left px-6 py-3 font-medium">When</th>
                  <th className="text-right px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((it) => {
                  const isDiseaseMode = it.mode === "disease";
                  const isQualityMode = it.mode === "quality";
                  return (
                    <tr key={it.id} className="hover:bg-leaf-50/40 dark:hover:bg-leaf-900/10">
                      <td className="px-6 py-3">
                        {it.image_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={api.asset(it.image_url)}
                            alt=""
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-leaf-100 dark:bg-leaf-800/30 flex items-center justify-center">
                            <Leaf className="h-4 w-4 text-leaf-700 dark:text-leaf-300" />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <Badge tone={modeTone(it.mode)}>{modeLabel(it.mode)}</Badge>
                      </td>
                      <td className="px-6 py-3">
                        {isQualityMode ? (
                          <span className="text-xs text-[var(--fg-muted)] italic">Not run</span>
                        ) : (
                          <>
                            <p className="font-medium">{it.disease_label}</p>
                            <p className="text-xs font-mono text-[var(--fg-muted)]">
                              {formatPercent(it.disease_confidence)}
                            </p>
                          </>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        {isDiseaseMode ? (
                          <span className="text-xs text-[var(--fg-muted)] italic">Not run</span>
                        ) : (
                          <>
                            <Badge
                              tone={
                                it.quality_grade.endsWith("A")
                                  ? "success"
                                  : it.quality_grade.endsWith("B")
                                  ? "warning"
                                  : "danger"
                              }
                            >
                              {it.quality_grade}
                            </Badge>
                            <p className="mt-1 text-xs font-mono text-[var(--fg-muted)]">
                              {formatPercent(it.quality_confidence)}
                            </p>
                          </>
                        )}
                      </td>
                      <td className="px-6 py-3 text-[var(--fg-muted)]">{formatDate(it.timestamp)}</td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => remove(it.id)}
                          aria-label="Delete"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--fg-muted)] hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[var(--border)]">
              {filtered.map((it) => {
                const isDiseaseMode = it.mode === "disease";
                const isQualityMode = it.mode === "quality";
                return (
                  <div key={it.id} className="p-4 flex items-start gap-3">
                    {it.image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={api.asset(it.image_url)}
                        alt=""
                        className="h-14 w-14 rounded-xl object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-xl bg-leaf-100 dark:bg-leaf-800/30 flex items-center justify-center shrink-0">
                        <Leaf className="h-5 w-5 text-leaf-700 dark:text-leaf-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge tone={modeTone(it.mode)}>{modeLabel(it.mode)}</Badge>
                      </div>
                      {!isQualityMode && (
                        <p className="font-medium truncate">{it.disease_label}</p>
                      )}
                      <p className="text-xs text-[var(--fg-muted)]">{formatDate(it.timestamp)}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {!isDiseaseMode && (
                          <Badge
                            tone={
                              it.quality_grade.endsWith("A")
                                ? "success"
                                : it.quality_grade.endsWith("B")
                                ? "warning"
                                : "danger"
                            }
                          >
                            {it.quality_grade}
                          </Badge>
                        )}
                        {!isQualityMode && (
                          <Badge tone="neutral">{formatPercent(it.disease_confidence, 0)}</Badge>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => remove(it.id)}
                      aria-label="Delete"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--fg-muted)] hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

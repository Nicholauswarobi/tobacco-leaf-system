"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Trash2,
  Download,
  Leaf,
  Search,
  Microscope,
  Award,
  RefreshCw,
} from "lucide-react";

import { api } from "@/lib/api";
import type { HistoryItem } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConnectionError } from "@/components/ui/connection-error";
import { formatDate, formatPercent } from "@/lib/utils";
import { useI18n, type TKey } from "@/lib/i18n";
import { diseaseName, gradeName } from "@/lib/leaf-content";

const MODE_FILTERS: { value: "all" | "disease" | "quality" | "full"; label: TKey }[] = [
  { value: "all", label: "hist.all" },
  { value: "disease", label: "hist.disease" },
  { value: "quality", label: "hist.quality" },
  { value: "full", label: "hist.full" },
];

export default function HistoryPage() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<"all" | "disease" | "quality" | "full">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.history(200);
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (id: string) => {
    if (!confirm(t("hist.deleteConfirm"))) return;
    try {
      await api.deleteHistory(id);
      setItems((arr) => arr.filter((x) => x.id !== id));
    } catch {
      setNotice(t("hist.deleteFailed"));
    }
  };

  const filtered = items.filter((it) => {
    if (modeFilter !== "all" && it.mode !== modeFilter) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      it.disease_label.toLowerCase().includes(q) ||
      diseaseName(it.disease_label, lang).toLowerCase().includes(q) ||
      it.quality_grade.toLowerCase().includes(q) ||
      it.id.toLowerCase().includes(q)
    );
  });

  const modeLabel = (mode: HistoryItem["mode"]) => {
    if (mode === "quality") return t("hist.quality");
    if (mode === "full") return t("hist.full");
    return t("hist.disease");
  };

  const modeTone = (mode: HistoryItem["mode"]) => {
    if (mode === "quality") return "tobacco" as const;
    if (mode === "full") return "neutral" as const;
    return "success" as const;
  };

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-5 py-8 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <p className="text-xs font-semibold tracking-wide text-leaf-700 dark:text-leaf-300">
            {t("hist.eyebrow")}
          </p>
          <h1 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight">
            {t("hist.title")}
          </h1>
          <p className="mt-3 text-[var(--fg-muted)] max-w-xl">{t("hist.lead")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {t("common.refresh")}
          </Button>
          <a href={api.exportCsvUrl()} download>
            <Button variant="outline">
              <Download className="h-4 w-4" />
              {t("hist.export")}
            </Button>
          </a>
          <Link href="/disease">
            <Button>{t("common.newAnalysis")}</Button>
          </Link>
        </div>
      </header>

      {/* Search + filter row */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
          <input
            type="search"
            placeholder={t("hist.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-11 pl-11 pr-4 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] text-sm placeholder:text-[var(--fg-muted)] focus:outline-none focus:border-leaf-600"
          />
        </div>
        <div className="flex gap-2 items-center">
          {MODE_FILTERS.map((m) => (
            <button
              key={m.value}
              onClick={() => setModeFilter(m.value)}
              aria-pressed={modeFilter === m.value}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                modeFilter === m.value
                  ? "bg-leaf-700 text-white border-leaf-700"
                  : "border-[var(--border)] text-[var(--fg-muted)] hover:border-leaf-600 hover:text-[var(--fg)]"
              }`}
            >
              {t(m.label)}
            </button>
          ))}
        </div>
      </div>

      {!loading && !error && items.length > 0 && (
        <p className="mb-4 text-xs text-[var(--fg-muted)]">
          {t("hist.showing", { shown: filtered.length, total: items.length })}
        </p>
      )}

      {notice && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {notice}
        </div>
      )}

      {error ? (
        <ConnectionError
          title={t("hist.loadFailed")}
          body={t("common.noConnectionHelp")}
          retry={t("common.retry")}
          onRetry={() => void load()}
        />
      ) : (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] overflow-hidden">
          {loading ? (
            <div className="divide-y divide-[var(--border)]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-4">
                  <div className="h-10 w-10 shrink-0 animate-pulse rounded-md bg-[var(--border)]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-48 animate-pulse rounded bg-[var(--border)]" />
                    <div className="h-3 w-28 animate-pulse rounded bg-[var(--border)]" />
                  </div>
                  <div className="h-6 w-16 animate-pulse rounded-full bg-[var(--border)]" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center">
              <Leaf className="h-8 w-8 mx-auto mb-3 text-[var(--fg-muted)] opacity-50" />
              <p className="text-[var(--fg-muted)]">
                {items.length === 0 ? t("hist.empty") : t("hist.emptySearch")}
              </p>
              {items.length === 0 && (
                <Link
                  href="/disease"
                  className="mt-3 inline-block text-leaf-700 dark:text-leaf-300 hover:underline"
                >
                  {t("hist.emptyCta")} →
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <table className="hidden md:table w-full text-sm">
                <thead className="bg-leaf-50 dark:bg-leaf-900/20 text-xs font-semibold tracking-wide text-[var(--fg-muted)]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">{t("hist.colLeaf")}</th>
                    <th className="text-left px-4 py-3 font-medium">{t("hist.colType")}</th>
                    <th className="text-left px-4 py-3 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <Microscope className="h-3.5 w-3.5" /> {t("hist.colDisease")}
                      </span>
                    </th>
                    <th className="text-left px-4 py-3 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <Award className="h-3.5 w-3.5" /> {t("hist.colGrade")}
                      </span>
                    </th>
                    <th className="text-left px-4 py-3 font-medium">{t("hist.colWhen")}</th>
                    <th className="text-right px-4 py-3 font-medium">{t("hist.colActions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filtered.map((it) => {
                    const isDiseaseMode = it.mode === "disease";
                    const isQualityMode = it.mode === "quality";
                    return (
                      <tr key={it.id} className="hover:bg-leaf-50/40 dark:hover:bg-leaf-900/10">
                        <td className="px-4 py-3">
                          {it.image_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={api.asset(it.image_url)}
                              alt=""
                              className="h-10 w-10 rounded-md object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-md bg-leaf-100 dark:bg-leaf-800/30 flex items-center justify-center">
                              <Leaf className="h-4 w-4 text-leaf-700 dark:text-leaf-300" />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={modeTone(it.mode)}>{modeLabel(it.mode)}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          {isQualityMode ? (
                            <span className="text-xs text-[var(--fg-muted)] italic">
                              {t("hist.notRun")}
                            </span>
                          ) : (
                            <>
                              <p className="font-medium">
                                {diseaseName(it.disease_label, lang)}
                              </p>
                              <p className="text-xs font-mono text-[var(--fg-muted)]">
                                {formatPercent(it.disease_confidence)}
                              </p>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isDiseaseMode ? (
                            <span className="text-xs text-[var(--fg-muted)] italic">
                              {t("hist.notRun")}
                            </span>
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
                                {gradeName(it.quality_grade, lang)}
                              </Badge>
                              <p className="mt-1 text-xs font-mono text-[var(--fg-muted)]">
                                {formatPercent(it.quality_confidence)}
                              </p>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[var(--fg-muted)]">
                          {formatDate(it.timestamp)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => remove(it.id)}
                            aria-label={t("hist.colActions")}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--fg-muted)] hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
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
                    <div key={it.id} className="p-3 flex items-start gap-3">
                      {it.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={api.asset(it.image_url)}
                          alt=""
                          className="h-14 w-14 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-lg bg-leaf-100 dark:bg-leaf-800/30 flex items-center justify-center shrink-0">
                          <Leaf className="h-5 w-5 text-leaf-700 dark:text-leaf-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge tone={modeTone(it.mode)}>{modeLabel(it.mode)}</Badge>
                        </div>
                        {!isQualityMode && (
                          <p className="font-medium truncate">
                            {diseaseName(it.disease_label, lang)}
                          </p>
                        )}
                        <p className="text-xs text-[var(--fg-muted)]">
                          {formatDate(it.timestamp)}
                        </p>
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
                              {gradeName(it.quality_grade, lang)}
                            </Badge>
                          )}
                          {!isQualityMode && (
                            <Badge tone="neutral">
                              {formatPercent(it.disease_confidence, 0)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => remove(it.id)}
                        aria-label={t("hist.colActions")}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--fg-muted)] hover:bg-red-50 hover:text-red-700"
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
      )}
    </section>
  );
}

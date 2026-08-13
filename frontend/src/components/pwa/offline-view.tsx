"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, History } from "lucide-react";

import { useI18n } from "@/lib/i18n";

export function OfflineView() {
  const { t } = useI18n();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-3 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded bg-leaf-100 text-leaf-800 dark:bg-leaf-800/60 dark:text-leaf-100">
        <WifiOff className="h-7 w-7" />
      </span>

      <h1 className="mt-3 font-display text-2xl text-[var(--fg)]">
        {t("offline.title")}
      </h1>
      <p className="mt-2 text-sm text-[var(--fg-muted)]">
        {t("offline.body")}
      </p>

      {online && (
        <p className="mt-2 text-sm font-medium text-leaf-700 dark:text-leaf-300">
          {t("offline.backOnline")}
        </p>
      )}

      <div className="mt-3 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <button
          onClick={() => window.location.reload()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-leaf-700 px-3 text-sm font-medium text-parchment dark:bg-leaf-300 dark:text-leaf-900"
        >
          <RefreshCw className="h-4 w-4" />
          {t("common.retry")}
        </button>
        <Link
          href="/history"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-sm border border-[var(--border)] px-3 text-sm font-medium text-[var(--fg)]"
        >
          <History className="h-4 w-4" />
          {t("offline.viewSaved")}
        </Link>
      </div>

      <p className="mt-3 text-xs text-[var(--fg-muted)]">
        {t("offline.note")}
      </p>
    </div>
  );
}

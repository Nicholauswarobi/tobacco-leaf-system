"use client";

import { RefreshCw, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Shown when the API cannot be reached.
 *
 * Deliberately free of ports, status codes and stack traces: the person
 * reading this is a farmer holding a phone, and none of that helps them. It
 * says what happened and gives them the one action that might fix it.
 */
export function ConnectionError({
  title,
  body,
  retry,
  onRetry,
}: {
  title: string;
  body: string;
  retry: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] px-4 py-10 text-center">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
        <WifiOff className="h-5 w-5" />
      </div>
      <h3 className="mt-3 font-display text-2xl tracking-tight">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--fg-muted)]">{body}</p>
      <Button className="mt-4" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" />
        {retry}
      </Button>
    </div>
  );
}

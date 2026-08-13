"use client";

/**
 * Registers the service worker and starts capturing the install prompt.
 *
 * Renders nothing on its own except the update notice. Mounted once, from the
 * root layout.
 */

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { useI18n } from "@/lib/i18n";

import { startInstallCapture } from "./install-listener";

export function ServiceWorker() {
  const { t } = useI18n();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    startInstallCapture();

    if (!("serviceWorker" in navigator)) return;

    // In development the worker would serve stale chunks between edits and
    // make every change look like it did not apply.
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((reg) => void reg.unregister()));
      return;
    }

    let cancelled = false;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        if (cancelled) return;

        // A worker already waiting means the page was opened with an update
        // pending from a previous visit.
        if (reg.waiting && navigator.serviceWorker.controller) {
          setWaiting(reg.waiting);
        }

        reg.addEventListener("updatefound", () => {
          const next = reg.installing;
          if (!next) return;

          next.addEventListener("statechange", () => {
            // `controller` is null on the very first install. Prompting then
            // would ask someone to reload a page that is already current.
            if (next.state === "installed" && navigator.serviceWorker.controller) {
              setWaiting(next);
            }
          });
        });
      } catch {
        // An unregistrable worker costs offline support, not the app. This is
        // the normal outcome over plain http on a phone, where the origin is
        // not a secure context.
      }
    };

    void register();

    // The new worker takes over only after it activates; reloading then picks
    // up the fresh assets.
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange
    );

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
    };
  }, []);

  if (!waiting) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[55] p-3 sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-3 shadow-card">
        <RefreshCw className="h-4 w-4 shrink-0 text-leaf-700 dark:text-leaf-300" />
        <p className="min-w-0 flex-1 text-sm text-[var(--fg)]">
          {t("install.updateReady")}
        </p>
        <button
          onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })}
          className="shrink-0 rounded-md bg-leaf-700 px-4 py-2 text-sm font-medium text-parchment dark:bg-leaf-300 dark:text-leaf-900"
        >
          {t("install.updateAction")}
        </button>
      </div>
    </div>
  );
}

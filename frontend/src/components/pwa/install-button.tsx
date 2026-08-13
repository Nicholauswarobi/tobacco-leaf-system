"use client";

/**
 * "Install app" affordances.
 *
 * The button hides only when the app is already installed. It deliberately
 * stays put when the browser has no install prompt to offer, because that is
 * the case the user most needs explaining: `beforeinstallprompt` never fires
 * in `npm run dev`, and never over plain http on a phone. A button that
 * disappears in exactly those situations looks like a missing feature.
 */

import { useEffect, useState } from "react";
import {
  Download,
  Share,
  Plus,
  X,
  Check,
  MoreVertical,
  ShieldAlert,
} from "lucide-react";

import { useI18n, type TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { useInstall, type Platform } from "./use-install";

/**
 * Compact button for the navbar.
 *
 * On Chromium it fires the native prompt. Everywhere else it opens the steps
 * for that browser, since only Chromium exposes an install API.
 */
export function InstallButton({
  className,
  compact = false,
}: {
  className?: string;
  /**
   * Hide the label below `xl`, leaving just the icon. From `lg` up, the full
   * navigation shares one row with both toggles and this button, and the
   * label is what tips that row past the viewport width.
   */
  compact?: boolean;
}) {
  const { t } = useI18n();
  const { method, isStandalone, ready, platform, isSecureContext, promptToInstall } =
    useInstall();
  const [showSteps, setShowSteps] = useState(false);

  // Rendering before the checks resolve would flash an install button at
  // someone already running the installed app.
  if (!ready || isStandalone) return null;

  return (
    <>
      <button
        onClick={() => {
          if (method === "prompt") void promptToInstall();
          else setShowSteps(true);
        }}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border border-leaf-200 bg-leaf-50 px-3",
          "text-sm font-medium text-leaf-900 transition-colors hover:bg-leaf-100",
          "dark:border-leaf-700 dark:bg-leaf-800/40 dark:text-leaf-100 dark:hover:bg-leaf-800/70",
          className
        )}
      >
        <Download className="h-4 w-4 shrink-0" />
        <span className={cn(compact && "hidden xl:inline")}>
          {t("install.button")}
        </span>
      </button>

      {showSteps && (
        <InstallInstructions
          platform={platform}
          isSecureContext={isSecureContext}
          onClose={() => setShowSteps(false)}
        />
      )}
    </>
  );
}

/**
 * One-time banner along the bottom of the screen.
 *
 * The navbar button sits behind the menu on a phone, and the whole point of
 * this app is that it lives on a farmer's home screen. Dismissal is
 * remembered, so it asks once and never nags.
 */
export function InstallBanner() {
  const { t } = useI18n();
  const {
    method,
    isStandalone,
    justInstalled,
    ready,
    platform,
    isSecureContext,
    promptToInstall,
  } = useInstall();
  // Starts dismissed and is un-dismissed after mount: reading localStorage
  // during render would make the client's first paint disagree with the
  // server's, which React reports as a hydration error.
  const [dismissed, setDismissed] = useState(true);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const dismiss = () => {
    setDismissed(true);
    window.localStorage.setItem(DISMISS_KEY, "1");
  };

  if (justInstalled) return <InstalledToast message={t("install.done")} />;
  if (!ready || dismissed || isStandalone) return null;

  return (
    <>
      {/*
        A fixed bar sits on top of whatever is at the bottom of the page — on
        the analysis pages that was the "Check now" button and the progress
        readout, both invisible behind it. This spacer occupies the same height
        in normal flow so the end of the document can always be scrolled clear.
      */}
      <div aria-hidden className="h-28 sm:hidden" />

      <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:hidden">
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-3 shadow-card">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-leaf-700 dark:bg-leaf-300">
            <Download className="h-5 w-5 text-parchment dark:text-leaf-900" />
          </span>

          {/* Clamped so a long translation cannot grow this bar into a third
              of the screen — it overlays the page, so its height is a cost
              paid by every page underneath it. */}
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm font-semibold text-[var(--fg)]">
              {t("install.bannerTitle")}
            </p>
            <p className="line-clamp-2 text-xs text-[var(--fg-muted)]">
              {t("install.bannerBody")}
            </p>
          </div>

          <button
            onClick={() => {
              if (method === "prompt") {
                void promptToInstall().then((ok) => ok && dismiss());
              } else {
                setShowSteps(true);
              }
            }}
            className="shrink-0 rounded-full bg-leaf-700 px-4 py-2 text-sm font-medium text-parchment dark:bg-leaf-300 dark:text-leaf-900"
          >
            {t("install.button")}
          </button>

          <button
            onClick={dismiss}
            aria-label={t("install.dismiss")}
            className="shrink-0 rounded-full p-1 text-[var(--fg-muted)] hover:bg-leaf-100 dark:hover:bg-leaf-800/50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showSteps && (
        <InstallInstructions
          platform={platform}
          isSecureContext={isSecureContext}
          onClose={() => {
            setShowSteps(false);
            dismiss();
          }}
        />
      )}
    </>
  );
}

const DISMISS_KEY = "tobaccoscan-install-dismissed";

/** Brief confirmation after the browser reports a successful install. */
function InstalledToast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:bottom-4">
      <div className="mx-auto flex max-w-sm items-center gap-2 rounded-full border border-leaf-200 bg-leaf-50 px-4 py-3 text-sm text-leaf-900 shadow-card dark:border-leaf-700 dark:bg-leaf-800 dark:text-leaf-50">
        <Check className="h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
    </div>
  );
}

/** The steps for the browser in front of us, since none of them agree. */
const STEPS: Record<Platform, { icon: typeof Share; key: TKey }[]> = {
  ios: [
    { icon: Share, key: "install.iosStep1" },
    { icon: Plus, key: "install.iosStep2" },
    { icon: Check, key: "install.iosStep3" },
  ],
  android: [
    { icon: MoreVertical, key: "install.androidStep1" },
    { icon: Download, key: "install.androidStep2" },
    { icon: Check, key: "install.androidStep3" },
  ],
  desktop: [
    { icon: Download, key: "install.desktopStep1" },
    { icon: Check, key: "install.desktopStep2" },
  ],
};

/**
 * `platform` and `isSecureContext` arrive as props rather than from another
 * `useInstall()` call: a fresh hook would start on its defaults and correct
 * itself in an effect, flashing the desktop steps at a phone user first.
 */
function InstallInstructions({
  platform,
  isSecureContext,
  onClose,
}: {
  platform: Platform;
  isSecureContext: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();

  const steps = STEPS[platform];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-5 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-lg text-[var(--fg)]">
            {t("install.stepsTitle")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("install.dismiss")}
            className="rounded-full p-1 text-[var(--fg-muted)] hover:bg-leaf-100 dark:hover:bg-leaf-800/50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/*
          The single most common reason no install option appears. Without this
          the steps below are a dead end: the browser menu simply will not have
          the entry, and nothing on screen explains why.
        */}
        {!isSecureContext && (
          <div className="mt-4 flex gap-3 rounded-xl border border-tobacco-300 bg-tobacco-50 p-3 dark:border-tobacco-600 dark:bg-tobacco-800/40">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-tobacco-700 dark:text-tobacco-200" />
            <div className="text-xs leading-relaxed text-tobacco-900 dark:text-tobacco-100">
              <p className="font-semibold">{t("install.insecureTitle")}</p>
              <p className="mt-1">{t("install.insecureBody")}</p>
            </div>
          </div>
        )}

        <ol className="mt-4 space-y-3 text-sm text-[var(--fg-muted)]">
          {steps.map(({ icon: Icon, key }) => (
            <li key={key} className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-leaf-100 text-leaf-800 dark:bg-leaf-800/60 dark:text-leaf-100">
                <Icon className="h-4 w-4" />
              </span>
              <span>{t(key)}</span>
            </li>
          ))}
        </ol>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-full bg-leaf-700 px-4 py-3 text-sm font-medium text-parchment dark:bg-leaf-300 dark:text-leaf-900"
        >
          {t("install.gotIt")}
        </button>
      </div>
    </div>
  );
}

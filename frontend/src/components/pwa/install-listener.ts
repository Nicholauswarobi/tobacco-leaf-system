"use client";

/**
 * Module-level capture of the browser's install prompt.
 *
 * `beforeinstallprompt` fires once, very early, typically before any React
 * component that wants to render an install button has mounted. Listening for
 * it inside that component therefore misses it on most page loads. So the
 * event is caught here, held, and re-announced as a custom event that late
 * mounters can subscribe to.
 */

/** Fired on `window` once a deferred prompt is available. */
export const INSTALL_PROMPT_EVENT = "tobaccoscan:installable";

/**
 * The non-standard event Chromium fires. It is not in lib.dom.d.ts, because
 * no specification has settled on it.
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt: () => Promise<void>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let listening = false;

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return deferred;
}

export function clearDeferredPrompt(): void {
  deferred = null;
}

/**
 * Start listening. Safe to call repeatedly: only the first call binds.
 */
export function startInstallCapture(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    // Without this the browser shows its own mini-infobar and never hands the
    // event over, so the in-app button would have nothing to fire.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event(INSTALL_PROMPT_EVENT));
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
  });
}

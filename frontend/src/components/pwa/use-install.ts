"use client";

/**
 * Everything the UI needs to offer "install this app", across the two very
 * different ways browsers handle it.
 *
 * Chrome, Edge and Samsung Internet fire `beforeinstallprompt`, which hands us
 * an event we can replay later from a real click. Safari on iOS fires nothing
 * and exposes no API at all: installing is a manual trip through the Share
 * sheet, so there the only honest thing to do is show the instructions.
 *
 * The event arrives once, early, and often before this hook mounts. It is
 * therefore captured in the app layout (see `install-listener.ts`) and stashed
 * on `window`, and this hook picks it up from there.
 */

import { useCallback, useEffect, useState } from "react";

import {
  INSTALL_PROMPT_EVENT,
  getDeferredPrompt,
  clearDeferredPrompt,
} from "./install-listener";

export type InstallMethod = "prompt" | "ios-manual" | "manual";

export type Platform = "ios" | "android" | "desktop";

export interface InstallState {
  /** The browser gave us a prompt we can fire from a click. */
  canPrompt: boolean;
  /** Already running as an installed app: offer nothing. */
  isStandalone: boolean;
  /** Installed during this session. */
  justInstalled: boolean;
  /**
   * `prompt` when the browser handed us an event to fire; otherwise the user
   * has to be walked through their own browser's menu.
   */
  method: InstallMethod;
  platform: Platform;
  /**
   * False on plain http over anything but localhost. Service workers, and so
   * installation: are refused outright there, and no amount of tapping will
   * change it, so the UI has to say so.
   */
  isSecureContext: boolean;
  /** Everything is measured; safe to render install UI without a flash. */
  ready: boolean;
  /** Fires the native prompt. Resolves true if the user accepted. */
  promptToInstall: () => Promise<boolean>;
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    // iOS Safari's own flag, which predates the standard media query.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "desktop";
  const ua = window.navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac, and is told apart by touch support.
  const iPadOS =
    /Macintosh/.test(ua) && (window.navigator.maxTouchPoints ?? 0) > 1;
  if (/iPad|iPhone|iPod/.test(ua) || iPadOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export function useInstall(): InstallState {
  // Every value starts false so the server render and the first client render
  // agree; the real state lands in the effect below.
  const [canPrompt, setCanPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [isSecureContext, setIsSecureContext] = useState(true);
  const [justInstalled, setJustInstalled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setIsStandalone(detectStandalone());
    setPlatform(detectPlatform());
    setIsSecureContext(window.isSecureContext);
    setCanPrompt(getDeferredPrompt() !== null);
    setReady(true);

    // The layout listener re-broadcasts `beforeinstallprompt`, so a prompt
    // that arrived before this component mounted is not missed.
    const onAvailable = () => setCanPrompt(true);
    const onInstalled = () => {
      setJustInstalled(true);
      setCanPrompt(false);
      clearDeferredPrompt();
    };

    window.addEventListener(INSTALL_PROMPT_EVENT, onAvailable);
    window.addEventListener("appinstalled", onInstalled);

    // Catches the switch into standalone without a reload.
    const display = window.matchMedia("(display-mode: standalone)");
    const onDisplayChange = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
    display.addEventListener("change", onDisplayChange);

    return () => {
      window.removeEventListener(INSTALL_PROMPT_EVENT, onAvailable);
      window.removeEventListener("appinstalled", onInstalled);
      display.removeEventListener("change", onDisplayChange);
    };
  }, []);

  const promptToInstall = useCallback(async () => {
    const deferred = getDeferredPrompt();
    if (!deferred) return false;

    await deferred.prompt();
    const { outcome } = await deferred.userChoice;

    // A prompt can only be shown once. Dismissed means the browser will offer
    // a fresh one on a later visit, so the button hides until then.
    clearDeferredPrompt();
    setCanPrompt(false);

    return outcome === "accepted";
  }, []);

  // There is no "cannot install" branch on purpose. A button that vanishes
  // teaches the user nothing, and it vanished exactly when they needed it,
  // since `beforeinstallprompt` never fires in dev or over plain http. When
  // there is no prompt to fire, the UI explains their browser's own route.
  const method: InstallMethod = canPrompt
    ? "prompt"
    : platform === "ios"
      ? "ios-manual"
      : "manual";

  return {
    canPrompt,
    isStandalone,
    justInstalled,
    method,
    platform,
    isSecureContext,
    ready,
    promptToInstall,
  };
}

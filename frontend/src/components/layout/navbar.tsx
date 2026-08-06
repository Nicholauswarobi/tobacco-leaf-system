"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "./theme-toggle";
import { LanguageToggle } from "./language-toggle";
import { useAppStore } from "@/store/app-store";
import { useI18n, type TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: TKey }[] = [
  { href: "/", label: "nav.home" },
  { href: "/disease", label: "nav.disease" },
  { href: "/quality", label: "nav.quality" },
  { href: "/dashboard", label: "nav.dashboard" },
  { href: "/history", label: "nav.history" },
  { href: "/about", label: "nav.about" },
];

export function Navbar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // The result page has no nav entry of its own — it belongs to whichever
  // section produced the analysis, so the tab the user came from stays lit.
  const latestMode = useAppStore((s) => s.latest?.mode);
  // The persisted store rehydrates only on the client; deferring to it until
  // after mount keeps the first client render identical to the server HTML.
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on navigation
  useEffect(() => setOpen(false), [pathname]);

  const activeHref = resolveActiveHref(pathname, mounted ? latestMode : undefined);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-all",
        scrolled
          ? "border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur-lg"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="shrink-0">
          <Logo />
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item) => {
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-full px-4 py-2 text-sm tracking-wide transition-colors",
                  active
                    ? "bg-leaf-100 font-semibold text-leaf-900 dark:bg-leaf-800/60 dark:text-leaf-50"
                    : "font-medium text-[var(--fg-muted)] hover:bg-leaf-50 hover:text-[var(--fg)] dark:hover:bg-leaf-800/25"
                )}
              >
                {t(item.label)}
                {active && (
                  <span className="absolute -bottom-1 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-leaf-700 dark:bg-leaf-300" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/disease"
            className="hidden lg:inline-flex h-9 items-center rounded-full bg-leaf-700 px-4 text-sm font-medium text-parchment hover:bg-leaf-800 transition-colors dark:bg-leaf-300 dark:text-leaf-900 dark:hover:bg-leaf-200"
          >
            {t("nav.start")}
          </Link>
          <LanguageToggle className="hidden sm:inline-flex" />
          <ThemeToggle />
          <button
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elev)]"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        className={cn(
          "md:hidden overflow-hidden border-t border-[var(--border)] bg-[var(--bg)] transition-[max-height,opacity]",
          open ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="flex flex-col px-5 py-4 gap-1">
          {NAV.map((item) => {
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between rounded-xl px-4 py-3 text-sm",
                  active
                    ? "bg-leaf-100 font-semibold text-leaf-900 dark:bg-leaf-800/60 dark:text-leaf-50"
                    : "font-medium text-[var(--fg-muted)] hover:bg-leaf-50 dark:hover:bg-leaf-800/20"
                )}
              >
                {t(item.label)}
                {active && (
                  <span className="h-1.5 w-1.5 rounded-full bg-leaf-700 dark:bg-leaf-300" />
                )}
              </Link>
            );
          })}
          <div className="mt-2 flex items-center justify-between border-t border-[var(--border)] pt-3 sm:hidden">
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)]">
              {t("nav.language")}
            </span>
            <LanguageToggle />
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * Which nav entry should read as active for the current URL.
 *
 * Pages without their own tab (`/result`, `/upload`) map back to the section
 * they belong to, so the highlight never disappears mid-flow.
 */
function resolveActiveHref(
  pathname: string | null,
  latestMode?: "disease" | "quality" | "full"
): string | null {
  if (!pathname) return null;
  if (pathname === "/") return "/";

  if (pathname.startsWith("/result")) {
    if (!latestMode) return null;
    return latestMode === "quality" ? "/quality" : "/disease";
  }
  if (pathname.startsWith("/upload")) return "/disease";

  const match = NAV.find(
    (item) => item.href !== "/" && pathname.startsWith(item.href)
  );
  return match?.href ?? null;
}

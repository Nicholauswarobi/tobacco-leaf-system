"use client";

import Link from "next/link";

import { Logo } from "@/components/ui/logo";
import { useI18n } from "@/lib/i18n";

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg)] mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-5 py-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-3 max-w-sm text-sm text-[var(--fg-muted)] leading-relaxed">
              {t("footer.tagline")}
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold tracking-wide text-[var(--fg-muted)] mb-4">
              {t("footer.use")}
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/disease" className="hover:text-leaf-700 dark:hover:text-leaf-300">{t("nav.disease")}</Link></li>
              <li><Link href="/quality" className="hover:text-leaf-700 dark:hover:text-leaf-300">{t("nav.quality")}</Link></li>
              <li><Link href="/history" className="hover:text-leaf-700 dark:hover:text-leaf-300">{t("nav.history")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold tracking-wide text-[var(--fg-muted)] mb-4">
              {t("footer.learn")}
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-leaf-700 dark:hover:text-leaf-300">{t("nav.about")}</Link></li>
              <li><Link href="/dashboard" className="hover:text-leaf-700 dark:hover:text-leaf-300">{t("nav.dashboard")}</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-[var(--border)] pt-4 text-xs text-[var(--fg-muted)]">
          <p>© {new Date().getFullYear()} TobaccoScan. {t("footer.rights")}</p>
        </div>
      </div>
    </footer>
  );
}

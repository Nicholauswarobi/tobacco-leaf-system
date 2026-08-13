"use client";

import { Languages } from "lucide-react";

import { LANGUAGES, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * English / Swahili switch.
 *
 * Rendered as two visible buttons rather than a dropdown: a farmer opening
 * this for the first time should be able to see that Kiswahili exists without
 * having to discover a menu.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t("nav.language")}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-sm border border-[var(--border)] bg-[var(--bg-elev)] p-0.5",
        className
      )}
    >
      <Languages
        className="ml-2 mr-0.5 h-3.5 w-3.5 shrink-0 text-[var(--fg-muted)]"
        aria-hidden
      />
      {LANGUAGES.map((l) => {
        const active = l.code === lang;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => setLang(l.code)}
            aria-pressed={active}
            title={l.label}
            className={cn(
              // min-h-8 rather than padding alone: at py-1 the segments were
              // 24px tall, below a comfortable thumb target on a phone.
              "inline-flex min-h-8 items-center rounded px-2.5 text-xs font-semibold transition-colors",
              active
                ? "bg-leaf-700 text-parchment dark:bg-leaf-300 dark:text-leaf-900"
                : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
            )}
          >
            {l.short}
          </button>
        );
      })}
    </div>
  );
}

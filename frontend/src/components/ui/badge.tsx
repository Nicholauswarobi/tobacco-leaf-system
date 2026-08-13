import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "leaf" | "tobacco" | "danger" | "success" | "warning";

const toneClasses: Record<Tone, string> = {
  neutral:
    "bg-[var(--border)] text-[var(--fg)]",
  leaf:
    "bg-leaf-100 text-leaf-800 dark:bg-leaf-800/40 dark:text-leaf-200",
  tobacco:
    "bg-tobacco-100 text-tobacco-800 dark:bg-tobacco-800/40 dark:text-tobacco-100",
  danger:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  success:
    "bg-leaf-200 text-leaf-900 dark:bg-leaf-700/40 dark:text-leaf-100",
  warning:
    "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-200",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = "neutral", ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium tracking-wide",
        // `rounded-full` resolves to a 9999px radius, which on a *single* line
        // is a pill — but as soon as the text wraps, the box grows tall and
        // that radius turns it into an ellipse. A fixed radius stays a
        // rounded rectangle at any height, so a long label degrades into a
        // chip rather than a blob.
        "rounded-lg",
        // Long labels break inside the badge instead of forcing the row wider
        // than the phone.
        "max-w-full break-words",
        toneClasses[tone],
        className
      )}
      {...rest}
    />
  );
}

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
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium tracking-wide",
        toneClasses[tone],
        className
      )}
      {...rest}
    />
  );
}

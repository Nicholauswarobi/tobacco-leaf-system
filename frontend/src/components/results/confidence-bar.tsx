"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/utils";

interface Props {
  label: string;
  value: number; // 0..1
  highlighted?: boolean;
  index?: number;
}

export function ConfidenceBar({ label, value, highlighted, index = 0 }: Props) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span
          className={cn(
            "font-medium",
            highlighted
              ? "text-leaf-800 dark:text-leaf-200"
              : "text-[var(--fg-muted)]"
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "font-mono tabular-nums",
            highlighted ? "text-leaf-800 dark:text-leaf-200" : "text-[var(--fg-muted)]"
          )}
        >
          {formatPercent(value)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
        <motion.div
          className={cn(
            "h-full rounded-full",
            highlighted
              ? "bg-leaf-700 dark:bg-leaf-300"
              : "bg-tobacco-300 dark:bg-tobacco-600"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 0.8, delay: 0.1 + index * 0.07, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 40 40"
        className="h-8 w-8 text-leaf-700 dark:text-leaf-300"
        fill="none"
        aria-hidden
      >
        <path
          d="M20 4 C 8 12, 6 28, 20 36 C 34 28, 32 12, 20 4 Z"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="currentColor"
          fillOpacity="0.12"
        />
        <path
          d="M20 4 V 36"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M20 12 C 16 14, 13 16, 11 19 M20 12 C 24 14, 27 16, 29 19 M20 20 C 16 22, 13 24, 12 27 M20 20 C 24 22, 27 24, 28 27 M20 28 C 17 30, 15 31, 14 33 M20 28 C 23 30, 25 31, 26 33"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>
      <span className="font-display text-xl tracking-tight">Folium</span>
    </span>
  );
}

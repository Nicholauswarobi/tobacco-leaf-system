"use client";

import { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-leaf-700 text-parchment hover:bg-leaf-800 dark:bg-leaf-300 dark:text-leaf-900 dark:hover:bg-leaf-200",
  secondary:
    "bg-tobacco-200 text-tobacco-900 hover:bg-tobacco-300 dark:bg-tobacco-700 dark:text-tobacco-100 dark:hover:bg-tobacco-600",
  ghost:
    "bg-transparent hover:bg-leaf-100 text-leaf-900 dark:text-leaf-100 dark:hover:bg-leaf-800/50",
  outline:
    "border border-[var(--border)] bg-transparent hover:bg-[var(--bg-elev)] text-[var(--fg)]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", isLoading, children, disabled, ...rest },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-wide",
        "transition-all duration-200 ease-out",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "active:scale-[0.98]",
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {isLoading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  )
);
Button.displayName = "Button";

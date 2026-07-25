import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)]",
        "shadow-card backdrop-blur-sm",
        className
      )}
      {...rest}
    />
  )
);
Card.displayName = "Card";

export const CardHeader = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6 border-b border-[var(--border)]", className)} {...rest} />
);

export const CardBody = ({ className, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6", className)} {...rest} />
);

export const CardTitle = ({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) => (
  <h3
    className={cn(
      "font-display text-2xl tracking-tight text-[var(--fg)]",
      className
    )}
    {...rest}
  />
);

export const CardDescription = ({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-sm text-[var(--fg-muted)] mt-1", className)} {...rest} />
);

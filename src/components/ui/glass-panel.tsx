import { cn } from "@/lib/utils";
import { type HTMLAttributes, forwardRef } from "react";

type GlassVariant = "sidebar" | "content" | "overlay" | "subtle";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant;
}

const variantStyles: Record<GlassVariant, string> = {
  sidebar: [
    "bg-black/40",
    "backdrop-blur-2xl",
    "border-r",
    "border-white/5",
  ].join(" "),
  content: [
    "bg-black/60",
    "backdrop-blur-xl",
  ].join(" "),
  overlay: [
    "bg-black/50",
    "backdrop-blur-2xl",
    "border",
    "border-white/10",
    "rounded-xl",
    "shadow-2xl",
  ].join(" "),
  subtle: [
    "bg-white/5",
    "backdrop-blur-md",
    "border",
    "border-white/5",
    "rounded-lg",
  ].join(" "),
};

const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, variant = "content", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "transition-colors duration-150 ease-in-out",
          variantStyles[variant],
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

GlassPanel.displayName = "GlassPanel";

export { GlassPanel };
export type { GlassPanelProps, GlassVariant };

import { cn } from "@/lib/utils";
import { isMacOS } from "@/lib/platform";

interface TitlebarProps {
  className?: string;
}

/**
 * Custom titlebar region that integrates with Tauri's overlay titlebar.
 * The data-tauri-drag-region attribute makes this area draggable.
 *
 * Platform differences:
 * - macOS: Traffic lights (close/minimize/maximize) at top-left, so we add
 *   left padding (~70px) to avoid overlapping them.
 * - Windows: Native caption buttons at top-right; no left padding needed
 *   but we add right padding to avoid overlapping the close/min/max buttons.
 */
export function Titlebar({ className }: TitlebarProps) {
  const mac = isMacOS();
  return (
    <div
      data-tauri-drag-region
      className={cn(
        "h-12 w-full shrink-0 select-none",
        mac ? "pl-[70px]" : "pl-4 pr-[140px]",
        className,
      )}
    />
  );
}

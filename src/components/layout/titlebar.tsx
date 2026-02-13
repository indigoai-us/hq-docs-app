import { cn } from "@/lib/utils";

interface TitlebarProps {
  className?: string;
}

/**
 * Custom titlebar region that integrates with Tauri's overlay titlebar.
 * The data-tauri-drag-region attribute makes this area draggable on macOS.
 * Traffic lights (close/minimize/maximize) are positioned by the OS in the
 * transparent overlay titlebar area.
 */
export function Titlebar({ className }: TitlebarProps) {
  return (
    <div
      data-tauri-drag-region
      className={cn(
        "h-12 w-full shrink-0 select-none",
        // Padding-left accounts for macOS traffic lights (~70px)
        "pl-[70px]",
        className,
      )}
    />
  );
}

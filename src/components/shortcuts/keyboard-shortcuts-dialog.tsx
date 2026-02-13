/**
 * Keyboard shortcuts help overlay.
 *
 * Glass-styled modal showing all available keyboard shortcuts,
 * grouped by category. Triggered by Cmd+/.
 */

import { X } from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { cn } from "@/lib/utils";
import {
  SHORTCUT_DEFINITIONS,
  type ShortcutDef,
} from "@/hooks/use-keyboard-shortcuts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KeyboardShortcutsDialogProps {
  /** Whether the dialog is visible */
  isOpen: boolean;
  /** Close the dialog */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Category labels
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  navigation: "Navigation",
  content: "Content",
};

const CATEGORY_ORDER = ["general", "navigation", "content"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KeyboardShortcutsDialog({
  isOpen,
  onClose,
}: KeyboardShortcutsDialogProps) {
  if (!isOpen) return null;

  // Group shortcuts by category
  const grouped = CATEGORY_ORDER.reduce<Record<string, ShortcutDef[]>>(
    (acc, cat) => {
      const items = SHORTCUT_DEFINITIONS.filter((s) => s.category === cat);
      if (items.length > 0) {
        acc[cat] = items;
      }
      return acc;
    },
    {},
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <GlassPanel
          variant="overlay"
          className="w-full max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">
              Keyboard Shortcuts
            </h2>
            <button
              onClick={onClose}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md",
                "text-white/40 transition-colors duration-150",
                "hover:bg-white/10 hover:text-white/70",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
            <div className="space-y-5">
              {Object.entries(grouped).map(([category, shortcuts]) => (
                <div key={category}>
                  <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                    {CATEGORY_LABELS[category] || category}
                  </h3>
                  <div className="space-y-1">
                    {shortcuts.map((shortcut) => (
                      <ShortcutRow
                        key={shortcut.label}
                        shortcut={shortcut}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-white/5 px-5 py-3">
            <p className="text-center text-[10px] text-white/20">
              Press <kbd className="mx-0.5 inline-flex items-center rounded border border-white/10 bg-white/5 px-1 text-[10px] text-white/40">Esc</kbd> to close
            </p>
          </div>
        </GlassPanel>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shortcut row
// ---------------------------------------------------------------------------

interface ShortcutRowProps {
  shortcut: ShortcutDef;
}

function ShortcutRow({ shortcut }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between rounded-md px-2 py-1.5">
      <span className="text-xs text-white/60">{shortcut.label}</span>
      <div className="flex items-center gap-1">
        {shortcut.keys.map((key, i) => (
          <span key={`${key}-${i}`} className="flex items-center gap-0.5">
            {i > 0 && shortcut.keys.length > 1 && key !== "+" && (
              <span className="text-[10px] text-white/15">+</span>
            )}
            <kbd
              className={cn(
                "inline-flex min-w-[20px] items-center justify-center",
                "rounded border border-white/10 bg-white/5",
                "px-1.5 py-0.5 text-[11px] font-medium text-white/50",
              )}
            >
              {key === "Cmd" ? "\u2318" : key}
            </kbd>
          </span>
        ))}
      </div>
    </div>
  );
}

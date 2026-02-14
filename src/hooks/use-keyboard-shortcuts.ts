/**
 * Central keyboard shortcuts hook for Indigo Docs.
 *
 * Registers all app-wide keyboard shortcuts and provides the shortcut
 * definitions for the help overlay. Individual components (sidebar tree,
 * command palette) handle their own local keyboard interactions.
 */

import { useEffect, useCallback } from "react";
import { modifierKeyLabel } from "@/lib/platform";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShortcutDef {
  /** Display keys (e.g. ["Cmd", "K"] on macOS or ["Ctrl", "K"] on Windows) */
  keys: string[];
  /** Human-readable label */
  label: string;
  /** Category for grouping in help overlay */
  category: "navigation" | "general" | "content";
}

// ---------------------------------------------------------------------------
// Shortcut definitions (shared with help overlay)
// ---------------------------------------------------------------------------

/** Platform-aware modifier key: "Cmd" on macOS, "Ctrl" on Windows/Linux */
const MOD = modifierKeyLabel();

export const SHORTCUT_DEFINITIONS: ShortcutDef[] = [
  // General
  { keys: [MOD, "K"], label: "Open search", category: "general" },
  { keys: [MOD, "B"], label: "Toggle sidebar", category: "general" },
  { keys: [MOD, ","], label: "Open settings", category: "general" },
  { keys: [MOD, "/"], label: "Show keyboard shortcuts", category: "general" },
  { keys: ["Esc"], label: "Close modal / clear search", category: "general" },

  // Navigation
  { keys: ["\u2191", "\u2193"], label: "Navigate sidebar tree", category: "navigation" },
  { keys: ["\u21B5"], label: "Open selected file", category: "navigation" },
  { keys: ["\u2190"], label: "Collapse directory", category: "navigation" },
  { keys: ["\u2192"], label: "Expand directory", category: "navigation" },

  // Content
  { keys: [MOD, "\u2191"], label: "Scroll to top", category: "content" },
  { keys: [MOD, "\u2193"], label: "Scroll to bottom", category: "content" },
];

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseKeyboardShortcutsOptions {
  /** Toggle search open/close */
  onToggleSearch: () => void;
  /** Toggle sidebar visibility */
  onToggleSidebar: () => void;
  /** Toggle settings modal */
  onToggleSettings: () => void;
  /** Toggle shortcuts help overlay */
  onToggleShortcuts: () => void;
  /** Close the topmost open overlay (search > shortcuts > about > settings) */
  onEscape: () => void;
  /** Which overlays are currently open (to manage Escape priority) */
  openOverlays: {
    search: boolean;
    settings: boolean;
    about: boolean;
    shortcuts: boolean;
  };
}

/**
 * Registers global keyboard shortcuts. Returns nothing — side effect only.
 *
 * Individual components (sidebar tree, command palette) handle their own
 * keyboard interactions (arrow keys, Enter) locally.
 */
export function useKeyboardShortcuts({
  onToggleSearch,
  onToggleSidebar,
  onToggleSettings,
  onToggleShortcuts,
  onEscape,
}: UseKeyboardShortcutsOptions): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      // Cmd+K — search
      if (meta && e.key === "k") {
        e.preventDefault();
        onToggleSearch();
        return;
      }

      // Cmd+B — toggle sidebar
      if (meta && e.key === "b") {
        e.preventDefault();
        onToggleSidebar();
        return;
      }

      // Cmd+, — settings
      if (meta && e.key === ",") {
        e.preventDefault();
        onToggleSettings();
        return;
      }

      // Cmd+/ — shortcuts help
      if (meta && e.key === "/") {
        e.preventDefault();
        onToggleShortcuts();
        return;
      }

      // Escape — close topmost overlay
      if (e.key === "Escape") {
        onEscape();
        return;
      }
    },
    [onToggleSearch, onToggleSidebar, onToggleSettings, onToggleShortcuts, onEscape],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Platform detection utilities.
 *
 * Detects macOS vs Windows/Linux for UI-facing shortcut labels.
 * Tauri menu accelerators already use "CmdOrCtrl+" which is cross-platform —
 * this module only affects the *display text* shown to users.
 */

/**
 * Returns true if the current platform is macOS.
 * Uses navigator.platform with userAgentData fallback.
 */
export function isMacOS(): boolean {
  // navigator.userAgentData is the modern API (Chromium-based browsers / Tauri WebView)
  const uaData = (navigator as NavigatorWithUAData).userAgentData;
  if (uaData?.platform) {
    return uaData.platform === "macOS";
  }

  // Fallback to navigator.platform (deprecated but widely supported)
  return /Mac|iPhone|iPod|iPad/.test(navigator.platform);
}

/**
 * Returns the platform-appropriate modifier key label.
 * - macOS: "Cmd" (rendered as ⌘ in UI)
 * - Windows/Linux: "Ctrl"
 */
export function modifierKeyLabel(): string {
  return isMacOS() ? "Cmd" : "Ctrl";
}

/**
 * Returns the platform-appropriate modifier key symbol for compact display.
 * - macOS: "⌘"
 * - Windows/Linux: "Ctrl"
 */
export function modifierKeySymbol(): string {
  return isMacOS() ? "\u2318" : "Ctrl";
}

// ---------------------------------------------------------------------------
// Internal type augmentation for userAgentData
// ---------------------------------------------------------------------------

interface NavigatorWithUAData extends Navigator {
  userAgentData?: {
    platform?: string;
  };
}

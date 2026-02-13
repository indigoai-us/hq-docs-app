/**
 * App configuration types and constants.
 * Config is persisted via @tauri-apps/plugin-store.
 */

export interface AppConfig {
  /** Path to the currently connected HQ folder */
  hqFolderPath: string | null;
  /** Last 3 connected folder paths for quick switching */
  recentFolders: string[];
}

export const DEFAULT_CONFIG: AppConfig = {
  hqFolderPath: null,
  recentFolders: [],
};

/** Maximum number of recent folders to remember */
export const MAX_RECENT_FOLDERS = 3;

/** Store key for app config */
export const CONFIG_STORE_KEY = "app-config";

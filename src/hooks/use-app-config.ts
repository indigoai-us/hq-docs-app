import { useState, useEffect, useCallback } from "react";
import { load } from "@tauri-apps/plugin-store";
import { open } from "@tauri-apps/plugin-dialog";
import { readDir } from "@tauri-apps/plugin-fs";
import {
  type AppConfig,
  DEFAULT_CONFIG,
  MAX_RECENT_FOLDERS,
  CONFIG_STORE_KEY,
} from "@/lib/config";

interface UseAppConfigReturn {
  /** Current app config */
  config: AppConfig;
  /** Whether config is still loading from disk */
  loading: boolean;
  /** Error message if config load/save failed */
  error: string | null;
  /** Open native folder picker and validate + save selection */
  pickFolder: () => Promise<boolean>;
  /** Set HQ folder path directly (validates first) */
  setHqFolder: (path: string) => Promise<boolean>;
  /** Clear current folder connection */
  disconnectFolder: () => Promise<void>;
  /** Whether app has a valid HQ folder connected */
  isConnected: boolean;
  /** Validation error for the current path (null if valid or no path) */
  pathError: string | null;
}

/**
 * Validates that a folder path contains at least one .md file.
 * Uses Tauri's fs plugin to read directory entries.
 */
async function validateHqFolder(path: string): Promise<string | null> {
  try {
    const entries = await readDir(path);
    const hasMd = entries.some(
      (entry) => entry.name?.endsWith(".md") || entry.isDirectory,
    );
    if (!hasMd) {
      return "Selected folder doesn't appear to be an HQ folder (no .md files or subdirectories found)";
    }
    return null;
  } catch {
    return "Cannot access the selected folder. It may have been moved or deleted.";
  }
}

/**
 * Hook for managing app configuration (HQ folder path, recent folders).
 * Persists config to Tauri's plugin-store (appConfigDir).
 */
export function useAppConfig(): UseAppConfigReturn {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pathError, setPathError] = useState<string | null>(null);

  // Load config from store on mount
  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      try {
        const store = await load(CONFIG_STORE_KEY);
        const saved = await store.get<AppConfig>("config");

        if (cancelled) return;

        if (saved) {
          setConfig(saved);

          // Validate saved path still exists
          if (saved.hqFolderPath) {
            const validationError = await validateHqFolder(
              saved.hqFolderPath,
            );
            if (validationError && !cancelled) {
              setPathError(validationError);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            `Failed to load config: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  // Save config to store
  const saveConfig = useCallback(async (newConfig: AppConfig) => {
    try {
      const store = await load(CONFIG_STORE_KEY);
      await store.set("config", newConfig);
      await store.save();
      setConfig(newConfig);
      setError(null);
    } catch (err) {
      setError(
        `Failed to save config: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }, []);

  // Add folder to recent list (deduped, capped)
  const addToRecent = useCallback(
    (path: string, currentConfig: AppConfig): string[] => {
      const filtered = currentConfig.recentFolders.filter((f) => f !== path);
      return [path, ...filtered].slice(0, MAX_RECENT_FOLDERS);
    },
    [],
  );

  // Open native folder picker dialog
  const pickFolder = useCallback(async (): Promise<boolean> => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select your HQ folder",
      });

      if (!selected) return false; // User cancelled

      const validationError = await validateHqFolder(selected);
      if (validationError) {
        setPathError(validationError);
        return false;
      }

      setPathError(null);
      const newConfig: AppConfig = {
        hqFolderPath: selected,
        recentFolders: addToRecent(selected, config),
      };
      await saveConfig(newConfig);
      return true;
    } catch (err) {
      setError(
        `Folder picker failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }, [config, saveConfig, addToRecent]);

  // Set folder path directly
  const setHqFolder = useCallback(
    async (path: string): Promise<boolean> => {
      const validationError = await validateHqFolder(path);
      if (validationError) {
        setPathError(validationError);
        return false;
      }

      setPathError(null);
      const newConfig: AppConfig = {
        hqFolderPath: path,
        recentFolders: addToRecent(path, config),
      };
      await saveConfig(newConfig);
      return true;
    },
    [config, saveConfig, addToRecent],
  );

  // Disconnect current folder
  const disconnectFolder = useCallback(async () => {
    const newConfig: AppConfig = {
      ...config,
      hqFolderPath: null,
    };
    setPathError(null);
    await saveConfig(newConfig);
  }, [config, saveConfig]);

  return {
    config,
    loading,
    error,
    pickFolder,
    setHqFolder,
    disconnectFolder,
    isConnected: config.hqFolderPath !== null && pathError === null,
    pathError,
  };
}

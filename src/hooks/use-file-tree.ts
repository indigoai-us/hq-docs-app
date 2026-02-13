/**
 * Hook for scanning and managing the HQ file tree.
 *
 * Features:
 * - Scans HQ directory using Rust-side Tauri command
 * - Caches results in Tauri store for instant subsequent loads
 * - Background re-scan when window regains focus (debounced 2s)
 * - Configurable scopes
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { load } from "@tauri-apps/plugin-store";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  type FileTreeNode,
  scanHqDirectory,
  getDefaultEnabledScopes,
} from "@/lib/scanner";

/** Store key for cached file tree */
const TREE_CACHE_KEY = "file-tree-cache";
/** Store key for enabled scopes */
const SCOPES_STORE_KEY = "enabled-scopes";
/** Debounce time for re-scan on focus (ms) */
const FOCUS_DEBOUNCE_MS = 2000;

interface TreeCache {
  /** Cached tree roots */
  roots: FileTreeNode[];
  /** HQ path that was scanned */
  hqPath: string;
  /** Scope IDs that were used */
  scopeIds: string[];
  /** Timestamp when cache was created */
  cachedAt: number;
}

interface UseFileTreeReturn {
  /** Array of tree root nodes (one per scope directory) */
  tree: FileTreeNode[];
  /** Whether the tree is currently loading */
  loading: boolean;
  /** Whether a background re-scan is in progress */
  rescanning: boolean;
  /** Error message if scan failed */
  error: string | null;
  /** Manually trigger a full re-scan */
  rescan: () => Promise<void>;
  /** Currently enabled scope IDs */
  enabledScopes: string[];
  /** Update which scopes are enabled (triggers re-scan) */
  setEnabledScopes: (scopeIds: string[]) => Promise<void>;
  /** Total .md file count across all scoped directories */
  totalFiles: number;
}

/**
 * Hook for managing the HQ file tree.
 *
 * @param hqPath - Absolute path to the connected HQ folder (null if not connected)
 */
export function useFileTree(hqPath: string | null): UseFileTreeReturn {
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabledScopes, setEnabledScopesState] = useState<string[]>(
    getDefaultEnabledScopes(),
  );
  const [totalFiles, setTotalFiles] = useState(0);

  // Track if initial load from cache has completed
  const initialLoadDone = useRef(false);
  // Track the latest scan to avoid stale updates
  const scanId = useRef(0);
  // Debounce timer for focus re-scan
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate total file count
  const updateTotalFiles = useCallback((roots: FileTreeNode[]) => {
    const total = roots.reduce((sum, root) => sum + root.fileCount, 0);
    setTotalFiles(total);
  }, []);

  // Load cached tree and scopes from store on mount
  useEffect(() => {
    if (!hqPath) {
      setTree([]);
      setTotalFiles(0);
      initialLoadDone.current = false;
      return;
    }

    let cancelled = false;

    async function loadFromCache() {
      try {
        const store = await load(TREE_CACHE_KEY);
        const cached = await store.get<TreeCache>("cache");

        if (cancelled) return;

        // Load cached scopes
        const scopeStore = await load(SCOPES_STORE_KEY);
        const savedScopes = await scopeStore.get<string[]>("scopes");
        if (savedScopes && savedScopes.length > 0 && !cancelled) {
          setEnabledScopesState(savedScopes);
        }

        // Use cache if it matches current path
        if (cached && cached.hqPath === hqPath && cached.roots.length > 0) {
          setTree(cached.roots);
          updateTotalFiles(cached.roots);
        }
      } catch {
        // Cache miss is fine - will scan fresh
      } finally {
        if (!cancelled) {
          initialLoadDone.current = true;
        }
      }
    }

    loadFromCache();
    return () => {
      cancelled = true;
    };
  }, [hqPath, updateTotalFiles]);

  // Perform a scan and update state + cache
  const performScan = useCallback(
    async (isBackground: boolean) => {
      if (!hqPath) return;

      const currentScanId = ++scanId.current;

      if (isBackground) {
        setRescanning(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const results = await scanHqDirectory(hqPath, enabledScopes);

        // Discard stale scan results
        if (currentScanId !== scanId.current) return;

        setTree(results);
        updateTotalFiles(results);

        // Save to cache
        try {
          const store = await load(TREE_CACHE_KEY);
          const cache: TreeCache = {
            roots: results,
            hqPath,
            scopeIds: enabledScopes,
            cachedAt: Date.now(),
          };
          await store.set("cache", cache);
          await store.save();
        } catch {
          // Cache save failure is non-critical
        }
      } catch (err) {
        if (currentScanId !== scanId.current) return;
        setError(
          `Scan failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        if (currentScanId === scanId.current) {
          setLoading(false);
          setRescanning(false);
        }
      }
    },
    [hqPath, enabledScopes, updateTotalFiles],
  );

  // Initial scan when hqPath changes or on mount (after cache load)
  useEffect(() => {
    if (!hqPath) return;

    // Small delay to let cache load first
    const timer = setTimeout(() => {
      performScan(false);
    }, 50);

    return () => clearTimeout(timer);
  }, [hqPath, performScan]);

  // Background re-scan when window regains focus (debounced 2s)
  useEffect(() => {
    if (!hqPath) return;

    const appWindow = getCurrentWindow();

    const unlisten = appWindow.onFocusChanged(({ payload: focused }) => {
      if (!focused) return;

      // Debounce: clear previous timer
      if (focusTimer.current) {
        clearTimeout(focusTimer.current);
      }

      focusTimer.current = setTimeout(() => {
        performScan(true);
      }, FOCUS_DEBOUNCE_MS);
    });

    return () => {
      if (focusTimer.current) {
        clearTimeout(focusTimer.current);
      }
      // unlisten is a Promise<UnlistenFn>
      unlisten.then((fn) => fn());
    };
  }, [hqPath, performScan]);

  // Manual re-scan
  const rescan = useCallback(async () => {
    await performScan(false);
  }, [performScan]);

  // Update enabled scopes (persist + trigger re-scan)
  const setEnabledScopes = useCallback(
    async (scopeIds: string[]) => {
      setEnabledScopesState(scopeIds);

      // Persist to store
      try {
        const store = await load(SCOPES_STORE_KEY);
        await store.set("scopes", scopeIds);
        await store.save();
      } catch {
        // Persist failure is non-critical
      }
    },
    [],
  );

  return {
    tree,
    loading,
    rescanning,
    error,
    rescan,
    enabledScopes,
    setEnabledScopes,
    totalFiles,
  };
}

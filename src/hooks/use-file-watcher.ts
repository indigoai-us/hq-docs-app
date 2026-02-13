/**
 * Hook for watching file system changes via Tauri's Rust-based notify watcher.
 *
 * Features:
 * - Starts/stops watching when HQ path or scopes change
 * - Debounces file content changes (500ms per file, handled Rust-side)
 * - Debounces tree changes (1s frontend-side for add/delete batching)
 * - Calls onFileChange when a viewed file is modified
 * - Calls onTreeChange when files are added or removed
 * - Exposes watching status for UI indicator
 */

import { useSyncExternalStore, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { DEFAULT_SCOPES, type ScanScope } from "@/lib/scanner";

/** Payload emitted by the Rust file watcher. */
interface FsChangeEvent {
  /** Absolute path that changed */
  path: string;
  /** "modify" | "create" | "remove" */
  kind: string;
}

interface UseFileWatcherOptions {
  /** Absolute path to the HQ root folder (null if not connected) */
  hqPath: string | null;
  /** Currently enabled scope IDs */
  enabledScopes: string[];
  /** Called when a file's content changes (path of changed file) */
  onFileChange: (path: string) => void;
  /** Called when the tree structure changes (files added/removed) */
  onTreeChange: () => void;
}

interface UseFileWatcherReturn {
  /** Whether the watcher is actively running */
  watching: boolean;
}

/** Tree change debounce interval (ms) */
const TREE_DEBOUNCE_MS = 1000;

// Module-level watching state store (avoids setState-in-effect lint issues)
let watchingState = false;
const watchingListeners = new Set<() => void>();

function setWatchingState(value: boolean) {
  if (watchingState !== value) {
    watchingState = value;
    watchingListeners.forEach((l) => l());
  }
}

function subscribeWatching(listener: () => void) {
  watchingListeners.add(listener);
  return () => {
    watchingListeners.delete(listener);
  };
}

function getWatchingSnapshot() {
  return watchingState;
}

/**
 * Hook that manages the Tauri file watcher lifecycle.
 *
 * Starts watching when hqPath is set, stops on unmount or path change.
 * Emits callbacks for file content changes and tree structure changes.
 */
export function useFileWatcher({
  hqPath,
  enabledScopes,
  onFileChange,
  onTreeChange,
}: UseFileWatcherOptions): UseFileWatcherReturn {
  const watching = useSyncExternalStore(subscribeWatching, getWatchingSnapshot);
  const treeDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use refs for callbacks to avoid re-subscribing on every render
  const onFileChangeRef = useRef(onFileChange);
  const onTreeChangeRef = useRef(onTreeChange);

  useEffect(() => {
    onFileChangeRef.current = onFileChange;
  }, [onFileChange]);

  useEffect(() => {
    onTreeChangeRef.current = onTreeChange;
  }, [onTreeChange]);

  // Start/stop watcher when path or scopes change
  useEffect(() => {
    if (!hqPath) {
      setWatchingState(false);
      return;
    }

    let cancelled = false;

    // Resolve scope IDs to patterns
    const patterns = enabledScopes
      .map((id) => DEFAULT_SCOPES.find((s: ScanScope) => s.id === id))
      .filter((s): s is ScanScope => s !== undefined)
      .map((s) => s.pattern);

    if (patterns.length === 0) {
      setWatchingState(false);
      return;
    }

    async function startWatcher() {
      try {
        await invoke("start_watching", {
          hqPath,
          scopes: patterns,
        });
        if (!cancelled) {
          setWatchingState(true);
        }
      } catch (err) {
        console.error("Failed to start file watcher:", err);
        if (!cancelled) {
          setWatchingState(false);
        }
      }
    }

    startWatcher();

    return () => {
      cancelled = true;
      // Stop the watcher on cleanup
      invoke("stop_watching").catch(() => {
        // Ignore errors on cleanup
      });
      setWatchingState(false);
    };
  }, [hqPath, enabledScopes]);

  // Listen for fs-change events from the Rust backend
  useEffect(() => {
    if (!hqPath) return;

    let unlisten: (() => void) | undefined;

    async function subscribe() {
      unlisten = await listen<FsChangeEvent>("fs-change", (event) => {
        const { path, kind } = event.payload;

        if (kind === "create" || kind === "remove") {
          // Tree structure change — debounce to batch rapid add/remove
          if (treeDebounceTimer.current) {
            clearTimeout(treeDebounceTimer.current);
          }
          treeDebounceTimer.current = setTimeout(() => {
            onTreeChangeRef.current();
          }, TREE_DEBOUNCE_MS);
        }

        if (kind === "modify" && path.endsWith(".md")) {
          // Content change on an .md file
          onFileChangeRef.current(path);
        }
      });
    }

    subscribe();

    return () => {
      unlisten?.();
      if (treeDebounceTimer.current) {
        clearTimeout(treeDebounceTimer.current);
      }
    };
  }, [hqPath]);

  return { watching };
}

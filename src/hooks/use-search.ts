/**
 * Hook for qmd-powered search with debouncing, mode switching, and collection scoping.
 *
 * Shells out to the Rust backend which invokes the qmd CLI.
 * Supports three search modes: keyword (fast), semantic, and hybrid (best quality).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SearchMode = "keyword" | "semantic" | "hybrid";

export interface SearchResult {
  /** qmd document ID */
  docId: string;
  /** Relevance score 0.0–1.0 */
  score: number;
  /** Document title */
  title: string;
  /** Display file path (qmd prefix stripped) */
  filePath: string;
  /** Matched text snippet */
  snippet: string;
}

interface QmdSearchResponse {
  results: Array<{
    docId: string;
    score: number;
    title: string;
    filePath: string;
    snippet: string;
  }>;
  total: number;
  error: string | null;
}

export type QmdStatus = "ready" | "unavailable" | "checking";

// ---------------------------------------------------------------------------
// Debounce intervals per search mode
// ---------------------------------------------------------------------------

const DEBOUNCE_MS: Record<SearchMode, number> = {
  keyword: 300,
  semantic: 500,
  hybrid: 500,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseSearchReturn {
  /** Current search results */
  results: SearchResult[];
  /** Whether a search is in flight */
  loading: boolean;
  /** Error message from qmd or the backend */
  error: string | null;
  /** Total result count from last search */
  total: number;
  /** Current search query */
  query: string;
  /** Update the search query (triggers debounced search) */
  setQuery: (q: string) => void;
  /** Current search mode */
  mode: SearchMode;
  /** Switch search mode */
  setMode: (m: SearchMode) => void;
  /** Current collection scope */
  collection: string;
  /** Switch collection scope */
  setCollection: (c: string) => void;
  /** Available qmd collections */
  collections: string[];
  /** Whether qmd CLI is available */
  qmdStatus: QmdStatus;
  /** Clear results and query */
  clear: () => void;
}

export function useSearch(): UseSearchReturn {
  const [query, setQueryState] = useState("");
  const [mode, setMode] = useState<SearchMode>("hybrid");
  const [collection, setCollection] = useState("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [collections, setCollections] = useState<string[]>([]);
  const [qmdStatus, setQmdStatus] = useState<QmdStatus>("checking");

  // Refs to track the latest search and debounce timer
  const searchIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check qmd availability on mount
  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const available = await invoke<boolean>("check_qmd_available");
        if (!cancelled) {
          setQmdStatus(available ? "ready" : "unavailable");
        }

        if (available) {
          try {
            const colls = await invoke<string[]>("list_qmd_collections");
            if (!cancelled) {
              setCollections(colls);
            }
          } catch {
            // Collections list failure is non-critical
          }
        }
      } catch {
        if (!cancelled) {
          setQmdStatus("unavailable");
        }
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  // Execute search
  const executeSearch = useCallback(
    async (q: string, m: SearchMode, c: string) => {
      if (!q.trim()) {
        setResults([]);
        setTotal(0);
        setError(null);
        setLoading(false);
        return;
      }

      const currentId = ++searchIdRef.current;
      setLoading(true);
      setError(null);

      try {
        const response = await invoke<QmdSearchResponse>("qmd_search", {
          query: q,
          mode: m,
          collection: c === "all" ? null : c,
          limit: 20,
        });

        // Discard stale results
        if (currentId !== searchIdRef.current) return;

        if (response.error) {
          setError(response.error);
          setResults([]);
          setTotal(0);
        } else {
          const mapped: SearchResult[] = response.results.map((r) => ({
            docId: r.docId || "",
            score: r.score || 0,
            title: r.title || r.filePath.split("/").pop() || "Untitled",
            filePath: r.filePath.replace(/^qmd:\/\/[^/]+\//, ""),
            snippet: r.snippet || "",
          }));
          setResults(mapped);
          setTotal(response.total);
        }
      } catch (err) {
        if (currentId !== searchIdRef.current) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setResults([]);
        setTotal(0);
      } finally {
        if (currentId === searchIdRef.current) {
          setLoading(false);
        }
      }
    },
    [],
  );

  // Debounced query setter
  const setQuery = useCallback(
    (q: string) => {
      setQueryState(q);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      if (!q.trim()) {
        setResults([]);
        setTotal(0);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      timerRef.current = setTimeout(() => {
        executeSearch(q, mode, collection);
      }, DEBOUNCE_MS[mode]);
    },
    [mode, collection, executeSearch],
  );

  // Re-search when mode or collection changes (if there's an active query)
  useEffect(() => {
    if (query.trim()) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setLoading(true);
      timerRef.current = setTimeout(() => {
        executeSearch(query, mode, collection);
      }, DEBOUNCE_MS[mode]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, collection]);

  // Clear everything
  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setQueryState("");
    setResults([]);
    setTotal(0);
    setError(null);
    setLoading(false);
    searchIdRef.current++;
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    results,
    loading,
    error,
    total,
    query,
    setQuery,
    mode,
    setMode,
    collection,
    setCollection,
    collections,
    qmdStatus,
    clear,
  };
}

import { useState, useEffect, useCallback } from "react";
import { readTextFile } from "@tauri-apps/plugin-fs";

interface UseFileContentReturn {
  /** File content as string, null if not loaded */
  content: string | null;
  /** Whether content is being loaded */
  loading: boolean;
  /** Error message if file read failed */
  error: string | null;
  /** Re-read the file */
  refresh: () => void;
}

/**
 * Hook that reads a file's text content from the filesystem via Tauri.
 * Automatically re-reads when the filePath changes.
 */
export function useFileContent(filePath: string | null): UseFileContentReturn {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!filePath) {
      setContent(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function loadContent() {
      try {
        const text = await readTextFile(filePath!);
        if (!cancelled) {
          setContent(text);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setContent(null);
          setError(
            `Failed to read file: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadContent();
    return () => {
      cancelled = true;
    };
  }, [filePath, refreshKey]);

  return { content, loading, error, refresh };
}

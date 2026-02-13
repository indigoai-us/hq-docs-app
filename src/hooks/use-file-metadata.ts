import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

/** Metadata about a file, returned from the Rust backend. */
export interface FileMetadata {
  /** Word count (whitespace-delimited tokens) */
  wordCount: number;
  /** Estimated reading time in minutes */
  readingTimeMinutes: number;
  /** File size in bytes */
  fileSize: number;
  /** Last modified timestamp (seconds since epoch) */
  modified: number | null;
  /** Absolute file path */
  filePath: string;
  /** Resolved symlink target path (null if not a symlink) */
  symlinkTarget: string | null;
  /** Source repository name extracted from symlink (e.g. "knowledge-ralph") */
  sourceRepoName: string | null;
}

interface UseFileMetadataReturn {
  /** File metadata, null if not loaded */
  metadata: FileMetadata | null;
  /** Last git commit date as ISO8601 string, null if unavailable */
  gitCommitDate: string | null;
  /** Whether metadata is loading */
  loading: boolean;
}

/**
 * Hook that fetches file metadata (word count, reading time, modified date,
 * symlink info) and git commit date for the given file path.
 *
 * Uses Tauri backend commands `get_file_metadata` and `get_git_commit_date`.
 */
export function useFileMetadata(filePath: string | null): UseFileMetadataReturn {
  const [metadata, setMetadata] = useState<FileMetadata | null>(null);
  const [gitCommitDate, setGitCommitDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!filePath) {
      setMetadata(null);
      setGitCommitDate(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const [meta, gitDate] = await Promise.all([
          invoke<FileMetadata>("get_file_metadata", { filePath }).catch(
            () => null,
          ),
          invoke<string | null>("get_git_commit_date", { filePath }).catch(
            () => null,
          ),
        ]);

        if (!cancelled) {
          setMetadata(meta);
          setGitCommitDate(gitDate ?? null);
        }
      } catch {
        if (!cancelled) {
          setMetadata(null);
          setGitCommitDate(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  return { metadata, gitCommitDate, loading };
}

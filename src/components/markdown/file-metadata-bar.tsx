import { useState, useMemo, useCallback } from "react";
import {
  Clock,
  FileText,
  Calendar,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FolderOpen,
  GitCommit,
  Link2,
} from "lucide-react";
import { cn, truncatePath } from "@/lib/utils";
import type { FileMetadata } from "@/hooks/use-file-metadata";

interface FileMetadataBarProps {
  /** File metadata from the Rust backend */
  metadata: FileMetadata | null;
  /** Last git commit date as ISO8601 string */
  gitCommitDate: string | null;
  /** Whether metadata is loading */
  loading: boolean;
  className?: string;
}

/**
 * Metadata bar displayed below the document title.
 *
 * Shows word count, reading time, and last modified date in a compact row.
 * Expands on click to reveal full file path, symlink source, and git commit date.
 * File path is clickable to open in VS Code or reveal in Finder.
 */
export function FileMetadataBar({
  metadata,
  gitCommitDate,
  loading,
  className,
}: FileMetadataBarProps) {
  const [expanded, setExpanded] = useState(false);

  /** Format a Unix timestamp (seconds) to a human-readable relative or absolute date. */
  const formatDate = useCallback((epochSeconds: number): string => {
    const date = new Date(epochSeconds * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? "s" : ""} ago`;
    }

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, []);

  /** Format an ISO8601 git commit date string. */
  const formattedGitDate = useMemo(() => {
    if (!gitCommitDate) return null;
    try {
      const date = new Date(gitCommitDate);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
      }

      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return null;
    }
  }, [gitCommitDate]);

  /** Truncated file path for display. */
  const displayPath = useMemo(() => {
    if (!metadata) return "";
    return truncatePath(metadata.filePath);
  }, [metadata]);

  /** Open file in VS Code via the vscode:// protocol. */
  const openInVSCode = useCallback(() => {
    if (!metadata) return;
    window.open(`vscode://file/${metadata.filePath}`, "_blank");
  }, [metadata]);

  /** Reveal file in Finder via the Tauri opener plugin. */
  const revealInFinder = useCallback(async () => {
    if (!metadata) return;
    try {
      const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
      await revealItemInDir(metadata.filePath);
    } catch {
      // Fallback: try the shell open approach
      // If opener plugin isn't available, silently fail
    }
  }, [metadata]);

  if (loading || !metadata) {
    return null;
  }

  return (
    <div className={cn("mb-4", className)}>
      {/* Compact metadata row */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="group flex w-full items-center gap-4 rounded-md px-1 py-1.5 text-xs text-white/40 transition-colors duration-150 hover:text-white/60"
        aria-expanded={expanded}
        aria-label="Toggle file details"
      >
        {/* Word count */}
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {metadata.wordCount.toLocaleString()} words
        </span>

        {/* Reading time */}
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {metadata.readingTimeMinutes} min read
        </span>

        {/* Last modified */}
        {metadata.modified && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(metadata.modified)}
          </span>
        )}

        {/* Symlink indicator */}
        {metadata.sourceRepoName && (
          <span className="flex items-center gap-1 text-primary/50">
            <Link2 className="h-3 w-3" />
            {metadata.sourceRepoName}
          </span>
        )}

        {/* Expand/collapse chevron */}
        <span className="ml-auto opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </span>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-1.5 space-y-1.5 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2.5 text-xs text-white/40">
          {/* Full file path */}
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-white/25">Path</span>
            <span className="min-w-0 flex-1 truncate font-mono text-white/50">
              {displayPath}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openInVSCode();
                }}
                className="rounded p-0.5 text-white/30 transition-colors duration-150 hover:bg-white/5 hover:text-primary"
                title="Open in VS Code"
                aria-label="Open in VS Code"
              >
                <ExternalLink className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  revealInFinder();
                }}
                className="rounded p-0.5 text-white/30 transition-colors duration-150 hover:bg-white/5 hover:text-primary"
                title="Reveal in Finder"
                aria-label="Reveal in Finder"
              >
                <FolderOpen className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Git commit date */}
          {formattedGitDate && (
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-white/25">Commit</span>
              <span className="flex items-center gap-1 text-white/50">
                <GitCommit className="h-3 w-3" />
                {formattedGitDate}
              </span>
            </div>
          )}

          {/* Symlink source repo */}
          {metadata.symlinkTarget && (
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-white/25">Source</span>
              <span className="min-w-0 flex-1 truncate font-mono text-primary/50">
                {metadata.sourceRepoName
                  ? metadata.sourceRepoName
                  : truncatePath(metadata.symlinkTarget)}
              </span>
            </div>
          )}

          {/* File size */}
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-white/25">Size</span>
            <span className="text-white/50">{formatFileSize(metadata.fileSize)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Format bytes into human-readable file size. */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

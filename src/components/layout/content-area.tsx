import { useEffect, useMemo, useRef, useCallback } from "react";
import { FileText, AlertCircle, Loader2 } from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { IndigoLogo } from "@/components/ui/indigo-logo";
import { Titlebar } from "@/components/layout/titlebar";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { MarkdownRenderer } from "@/components/markdown/markdown-renderer";
import { FileMetadataBar } from "@/components/markdown/file-metadata-bar";
import { IndexLandingPage } from "@/components/navigation/index-landing-page";
import { DirectoryListingPage } from "@/components/navigation/directory-listing-page";
import { useFileContent } from "@/hooks/use-file-content";
import { useFileMetadata } from "@/hooks/use-file-metadata";
import { findNodeByPath, type FileTreeNode } from "@/lib/scanner";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

interface ContentAreaProps {
  /** Absolute path to the currently selected file (null if none) */
  selectedFile?: string | null;
  /** Absolute path to the HQ root folder */
  hqFolderPath?: string | null;
  /** Callback when user clicks a relative .md link inside rendered content */
  onNavigate?: (relativePath: string) => void;
  /** Callback when user clicks a breadcrumb segment (navigates to absolute path) */
  onNavigateToPath?: (absolutePath: string) => void;
  /** Increment to force content refresh (used by file watcher) */
  refreshKey?: number;
  /** File tree roots for directory lookup */
  tree?: FileTreeNode[];
  className?: string;
}

/**
 * Main content area with slightly more opaque glass effect.
 * Renders the document viewer with markdown, breadcrumb, and table of contents.
 *
 * When the selected file is an INDEX.md, it renders a card-based landing page
 * parsed from the INDEX.md table rows. When the INDEX.md fails to load (not found),
 * it falls back to a directory listing page using the file tree data.
 */
export function ContentArea({
  selectedFile = null,
  hqFolderPath = null,
  onNavigate,
  onNavigateToPath,
  refreshKey = 0,
  tree = [],
  className,
}: ContentAreaProps) {
  const { content, loading, error, refresh } = useFileContent(selectedFile);
  const {
    metadata: fileMetadata,
    gitCommitDate,
    loading: metadataLoading,
  } = useFileMetadata(selectedFile);

  // Re-read file content when refreshKey changes (triggered by file watcher)
  const isFirstRender = useRef(true);
  useEffect(() => {
    // Skip the initial mount — only refresh on subsequent key changes
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    refresh();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect if this is an INDEX.md file
  const isIndexMd = useMemo(() => {
    if (!selectedFile) return false;
    return selectedFile.endsWith("/INDEX.md") || selectedFile === "INDEX.md";
  }, [selectedFile]);

  // Extract the directory path for resolving relative image/link paths
  const basePath = useMemo(() => {
    if (!selectedFile) return undefined;
    const parts = selectedFile.split("/");
    parts.pop();
    return parts.join("/");
  }, [selectedFile]);

  // Extract filename for display
  const fileName = useMemo(() => {
    if (!selectedFile) return null;
    return selectedFile.split("/").pop() || null;
  }, [selectedFile]);

  // Find directory node from tree (used for directory listing fallback)
  const directoryNode = useMemo(() => {
    if (!basePath || tree.length === 0) return null;
    return findNodeByPath(tree, basePath);
  }, [basePath, tree]);

  // Navigation handler for landing page cards (absolute paths)
  const handleLandingNavigate = useCallback(
    (absolutePath: string) => {
      if (onNavigateToPath) {
        onNavigateToPath(absolutePath);
      }
    },
    [onNavigateToPath],
  );

  // Determine what to render:
  // 1. INDEX.md loaded successfully → IndexLandingPage
  // 2. INDEX.md failed to load → DirectoryListingPage (if directory node exists in tree)
  // 3. Regular .md file → MarkdownRenderer
  // 4. No file selected → EmptyState

  const showIndexLanding = isIndexMd && content !== null && !loading && !error;
  const showDirectoryListing =
    isIndexMd && error && !loading && directoryNode !== null;
  const showMarkdown =
    !isIndexMd && content !== null && !loading && !error;

  return (
    <GlassPanel
      variant="content"
      className={cn("flex h-full flex-1 flex-col", className)}
    >
      {/* Titlebar drag region (continues across content area) */}
      <Titlebar className="pl-4" />

      {/* Breadcrumb area */}
      <div className="shrink-0 px-6 pb-2">
        <Breadcrumb
          selectedFile={selectedFile}
          hqFolderPath={hqFolderPath}
          onNavigateToPath={onNavigateToPath}
        />
      </div>

      {/* Document content */}
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="mx-auto max-w-5xl pt-4">
          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
                <span className="text-xs text-white/30">Loading document...</span>
              </div>
            </div>
          )}

          {/* INDEX.md landing page */}
          {showIndexLanding && basePath && (
            <IndexLandingPage
              content={content}
              directoryPath={basePath}
              onNavigate={handleLandingNavigate}
            />
          )}

          {/* Directory listing fallback (INDEX.md not found) */}
          {showDirectoryListing && directoryNode && (
            <DirectoryListingPage
              node={directoryNode}
              onNavigate={handleLandingNavigate}
            />
          )}

          {/* Error state (non-INDEX.md file errors) */}
          {error && !loading && !showDirectoryListing && (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Failed to load file
                </p>
                <p className="mt-1 text-xs text-white/50">{error}</p>
              </div>
            </div>
          )}

          {/* Regular markdown content */}
          {showMarkdown && (
            <>
              {/* File title header */}
              {fileName && (
                <div className="flex items-center gap-3 pb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <h1 className="text-lg font-semibold tracking-tight text-foreground">
                    {fileName}
                  </h1>
                </div>
              )}

              {/* File metadata bar: word count, reading time, modified date */}
              <FileMetadataBar
                metadata={fileMetadata}
                gitCommitDate={gitCommitDate}
                loading={metadataLoading}
              />

              <MarkdownRenderer
                content={content}
                basePath={basePath}
                onNavigate={onNavigate}
                showToc
              />
            </>
          )}

          {/* Empty state (no file selected) */}
          {!selectedFile && !loading && (
            <EmptyState />
          )}
        </div>
      </div>
    </GlassPanel>
  );
}

/** Welcome/empty state shown when no file is selected */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <IndigoLogo size={64} />
      <h2 className="mt-4 text-lg font-semibold text-foreground">
        {APP_NAME}
      </h2>
      <p className="mt-2 max-w-md text-center text-sm text-white/40">
        Select a file from the sidebar to start reading. Your markdown files
        will be rendered with syntax highlighting, tables, and more.
      </p>

      {/* Feature showcase */}
      <div className="mt-8 grid max-w-lg grid-cols-2 gap-3">
        {[
          { label: "GFM Tables", desc: "Full GitHub-flavored markdown" },
          { label: "Syntax Highlighting", desc: "Shiki-powered code blocks" },
          { label: "Task Lists", desc: "Interactive checkboxes" },
          { label: "Table of Contents", desc: "Auto-generated from headings" },
        ].map((feature) => (
          <div
            key={feature.label}
            className="rounded-lg border border-white/5 bg-white/[0.02] p-3"
          >
            <p className="text-xs font-medium text-white/60">{feature.label}</p>
            <p className="mt-0.5 text-xs text-white/30">{feature.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

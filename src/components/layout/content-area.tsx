import { useEffect, useMemo, useRef } from "react";
import { FileText, AlertCircle, Loader2 } from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { IndigoLogo } from "@/components/ui/indigo-logo";
import { Titlebar } from "@/components/layout/titlebar";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { MarkdownRenderer } from "@/components/markdown/markdown-renderer";
import { useFileContent } from "@/hooks/use-file-content";
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
  className?: string;
}

/**
 * Main content area with slightly more opaque glass effect.
 * Renders the document viewer with markdown, breadcrumb, and table of contents.
 */
export function ContentArea({
  selectedFile = null,
  hqFolderPath = null,
  onNavigate,
  onNavigateToPath,
  refreshKey = 0,
  className,
}: ContentAreaProps) {
  const { content, loading, error, refresh } = useFileContent(selectedFile);

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

  // (Breadcrumb logic is now handled by the Breadcrumb component)

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

          {/* Error state */}
          {error && !loading && (
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

          {/* Markdown content */}
          {content !== null && !loading && !error && (
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

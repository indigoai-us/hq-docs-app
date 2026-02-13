import { useState, useCallback, useRef, useEffect } from "react";
import {
  Search,
  Settings,
  ChevronRight,
  ChevronDown,
  FileText,
  FolderOpen,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { IndigoLogo } from "@/components/ui/indigo-logo";
import { Titlebar } from "@/components/layout/titlebar";
import { cn, truncatePath } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import type { FileTreeNode, TierGroup } from "@/lib/scanner";

interface SidebarProps {
  className?: string;
  /** Currently connected HQ folder path */
  hqFolderPath: string | null;
  /** Open settings modal */
  onOpenSettings: () => void;
  /** Open search command palette (Cmd+K) */
  onOpenSearch?: () => void;
  /** Callback when a file is selected for viewing */
  onSelectFile?: (filePath: string) => void;
  /** Currently selected file path */
  selectedFile?: string | null;
  /** File tree grouped by tier */
  tierGroups: TierGroup[];
  /** Flat tree roots (fallback when no tiers available) */
  tree: FileTreeNode[];
  /** Whether the tree is loading (initial scan) */
  treeLoading: boolean;
  /** Whether a background re-scan is in progress */
  rescanning: boolean;
  /** Tree scan error */
  treeError: string | null;
  /** Total .md file count */
  totalFiles: number;
  /** Current sidebar width in pixels */
  width: number;
  /** Whether the sidebar is being resized */
  isDragging: boolean;
  /** Mouse down handler for the drag handle */
  onResizeMouseDown: (e: React.MouseEvent) => void;
  /** Double-click handler for the drag handle (reset width) */
  onResizeReset: () => void;
  /** Whether the file watcher is actively running */
  watching?: boolean;
}

/**
 * Frosted glass sidebar with macOS-native feel.
 * Renders the file tree navigation grouped by tier, search trigger, and settings.
 * Features resizable width via drag handle and tier-based grouping.
 */
export function Sidebar({
  className,
  hqFolderPath,
  onOpenSettings,
  onOpenSearch,
  onSelectFile,
  selectedFile,
  tierGroups,
  tree,
  treeLoading,
  rescanning,
  treeError,
  totalFiles,
  width,
  isDragging,
  onResizeMouseDown,
  onResizeReset,
  watching = false,
}: SidebarProps) {
  const hasTiers = tierGroups.length > 0;

  return (
    <div className="relative flex shrink-0" style={{ width: `${width}px` }}>
      <GlassPanel
        variant="sidebar"
        className={cn("flex h-full w-full flex-col", className)}
      >
        {/* Titlebar drag region (traffic lights live here on macOS) */}
        <Titlebar />

        {/* Sidebar header: logo + search */}
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-2">
            <IndigoLogo size={28} />
            <span className="text-sm font-medium text-foreground/90">
              {APP_NAME}
            </span>
          </div>
          <button
            onClick={onOpenSearch}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md",
              "text-white/40 transition-colors duration-150",
              "hover:bg-white/10 hover:text-white/70",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
            )}
            title="Search (Cmd+K)"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* File tree area */}
        <div className="flex-1 overflow-y-auto px-2">
          {/* Loading state */}
          {treeLoading && tree.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary/50" />
              <span className="mt-2 text-xs text-white/30">
                Scanning files...
              </span>
            </div>
          )}

          {/* Error state */}
          {treeError && tree.length === 0 && (
            <div className="mx-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-xs text-destructive/80">{treeError}</p>
              </div>
            </div>
          )}

          {/* File tree grouped by tier */}
          {hasTiers && (
            <div className="space-y-1 py-1">
              {tierGroups.map((group) => (
                <TierSection
                  key={group.tier}
                  group={group}
                  onSelectFile={onSelectFile}
                  selectedFile={selectedFile}
                />
              ))}
            </div>
          )}

          {/* Fallback: ungrouped tree */}
          {!hasTiers && tree.length > 0 && (
            <div className="space-y-0.5 py-1">
              {tree.map((root) => (
                <TreeNode
                  key={root.path}
                  node={root}
                  onSelectFile={onSelectFile}
                  selectedFile={selectedFile}
                  defaultExpanded
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!treeLoading && !treeError && tree.length === 0 && hqFolderPath && (
            <div className="flex flex-col items-center justify-center py-8">
              <FolderOpen className="h-5 w-5 text-white/20" />
              <span className="mt-2 text-xs text-white/30">
                No .md files found in scoped directories
              </span>
            </div>
          )}
        </div>

        {/* Sidebar footer: watcher status + file count + rescanning indicator + settings + folder path */}
        <div className="border-t border-white/5 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {rescanning ? (
                <RefreshCw className="h-3 w-3 shrink-0 animate-spin text-primary/50" />
              ) : watching ? (
                <span
                  className="relative flex h-2 w-2 shrink-0"
                  title="Watching for file changes"
                >
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
              ) : null}
              <span className="truncate text-xs text-white/30">
                {rescanning
                  ? "Rescanning..."
                  : watching
                    ? "Watching..."
                    : hqFolderPath
                      ? truncatePath(hqFolderPath)
                      : "No folder connected"}
              </span>
              {totalFiles > 0 && (
                <span className="shrink-0 text-[10px] text-white/20">
                  ({totalFiles})
                </span>
              )}
            </div>
            <button
              onClick={onOpenSettings}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md",
                "text-white/30 transition-colors duration-150",
                "hover:bg-white/10 hover:text-white/50",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
              )}
              title="Settings (Cmd+,)"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </GlassPanel>

      {/* Resize drag handle */}
      <div
        onMouseDown={onResizeMouseDown}
        onDoubleClick={onResizeReset}
        className={cn(
          "absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize",
          "transition-colors duration-150",
          isDragging ? "bg-primary/40" : "hover:bg-primary/20",
        )}
        title="Drag to resize sidebar"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TierSection component — groups tree roots under a tier heading
// ---------------------------------------------------------------------------

interface TierSectionProps {
  group: TierGroup;
  onSelectFile?: (filePath: string) => void;
  selectedFile?: string | null;
}

/**
 * Collapsible section for a tier group (HQ Knowledge, Company Knowledge, Tools).
 */
function TierSection({ group, onSelectFile, selectedFile }: TierSectionProps) {
  const [expanded, setExpanded] = useState(true);

  const tierDotColors: Record<string, string> = {
    hq: "bg-primary",
    company: "bg-emerald-400",
    tools: "bg-amber-400",
  };

  return (
    <div>
      {/* Tier header */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left",
          "text-[10px] font-semibold uppercase tracking-wider",
          "text-white/35 transition-colors duration-150",
          "hover:bg-white/[0.03] hover:text-white/50",
        )}
      >
        <div
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            tierDotColors[group.tier] || "bg-white/30",
          )}
        />
        <span className="flex-1">{group.label}</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 text-white/20 transition-transform duration-150",
            !expanded && "-rotate-90",
          )}
        />
      </button>

      {/* Tier content with animated collapse */}
      <CollapsibleSection expanded={expanded}>
        <div className="space-y-0.5 pb-1">
          {group.roots.map((root) => (
            <TreeNode
              key={root.path}
              node={root}
              onSelectFile={onSelectFile}
              selectedFile={selectedFile}
              defaultExpanded
            />
          ))}
        </div>
      </CollapsibleSection>

      {/* Visual separator between tiers */}
      <div className="mx-3 border-b border-white/5" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CollapsibleSection — smooth expand/collapse animation
// ---------------------------------------------------------------------------

interface CollapsibleSectionProps {
  expanded: boolean;
  children: React.ReactNode;
}

/**
 * Wrapper that provides smooth height animation for expand/collapse.
 */
function CollapsibleSection({ expanded, children }: CollapsibleSectionProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">(expanded ? "auto" : 0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    if (expanded) {
      // Expanding: measure content height, animate from 0 to measured height
      const contentHeight = el.scrollHeight;
      setHeight(contentHeight);
      setIsAnimating(true);

      const timer = setTimeout(() => {
        setHeight("auto");
        setIsAnimating(false);
      }, 150);

      return () => clearTimeout(timer);
    } else {
      // Collapsing: set current height explicitly first, then animate to 0
      const contentHeight = el.scrollHeight;
      setHeight(contentHeight);
      setIsAnimating(true);

      // Force a reflow so the browser sees the explicit height before we change to 0
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      el.offsetHeight;

      requestAnimationFrame(() => {
        setHeight(0);
      });

      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [expanded]);

  return (
    <div
      ref={contentRef}
      style={{
        height: typeof height === "number" ? `${height}px` : height,
        overflow: isAnimating || !expanded ? "hidden" : "visible",
        transition: isAnimating ? "height 150ms ease-in-out" : "none",
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TreeNode component
// ---------------------------------------------------------------------------

interface TreeNodeProps {
  node: FileTreeNode;
  onSelectFile?: (filePath: string) => void;
  selectedFile?: string | null;
  defaultExpanded?: boolean;
}

/**
 * Recursive tree node component for rendering directories and files.
 * Directories have smooth expand/collapse animation.
 */
function TreeNode({
  node,
  onSelectFile,
  selectedFile,
  defaultExpanded = false,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isActive = !node.isDirectory && selectedFile === node.path;

  const handleClick = useCallback(() => {
    if (node.isDirectory) {
      setExpanded((prev) => !prev);
    } else if (onSelectFile) {
      onSelectFile(node.path);
    }
  }, [node, onSelectFile]);

  // Display name: use title for files if available, otherwise name
  const displayName = !node.isDirectory && node.title ? node.title : node.name;

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs",
          "transition-colors duration-150",
          isActive
            ? "border-l-2 border-primary bg-white/5 text-foreground"
            : "border-l-2 border-transparent text-white/60 hover:bg-white/5 hover:text-white/80",
        )}
        style={{ paddingLeft: `${(node.depth || 0) * 12 + 8}px` }}
        title={node.path}
      >
        {node.isDirectory ? (
          <>
            <ChevronRight
              className={cn(
                "h-3 w-3 shrink-0 text-white/30 transition-transform duration-150",
                expanded && "rotate-90",
              )}
            />
            <FolderOpen className="h-3 w-3 shrink-0 text-white/40" />
            <span className="min-w-0 truncate font-medium">{displayName}</span>
            {node.fileCount > 0 && (
              <span className="ml-auto shrink-0 text-[10px] text-white/25">
                {node.fileCount}
              </span>
            )}
          </>
        ) : (
          <>
            <FileText className="ml-3 h-3 w-3 shrink-0 text-white/30" />
            <span className="min-w-0 truncate">{displayName}</span>
          </>
        )}
      </button>

      {/* Children (expanded directories) with smooth animation */}
      {node.isDirectory && node.children.length > 0 && (
        <CollapsibleSection expanded={expanded}>
          <div className="space-y-0.5">
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                onSelectFile={onSelectFile}
                selectedFile={selectedFile}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

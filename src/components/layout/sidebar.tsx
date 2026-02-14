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
import { modifierKeyLabel } from "@/lib/platform";
import type { FileTreeNode, TierGroup } from "@/lib/scanner";
import { getCompanyIdsFromGroups } from "@/lib/scanner";

interface SidebarProps {
  className?: string;
  /** Currently connected HQ folder path */
  hqFolderPath: string | null;
  /** Open settings modal */
  onOpenSettings: () => void;
  /** Open search command palette (Cmd/Ctrl+K) */
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
  /** Active company filter (null = show all) */
  companyFilter?: string | null;
  /** Callback when company filter changes */
  onCompanyFilterChange?: (companyId: string | null) => void;
}

/**
 * Frosted glass sidebar with native platform feel.
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
  companyFilter = null,
  onCompanyFilterChange,
}: SidebarProps) {
  const hasTiers = tierGroups.length > 0;

  // Derive available company IDs from tier groups
  const companyIds = hasTiers ? getCompanyIdsFromGroups(tierGroups) : [];
  const hasCompanies = companyIds.length > 0;

  // Filter tier groups based on active company filter
  const filteredTierGroups = hasTiers && companyFilter
    ? tierGroups.filter(
        (g) => g.tier !== "company" || g.companyId === companyFilter,
      )
    : tierGroups;

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
            title={`Search (${modifierKeyLabel()}+K)`}
          >
            <Search className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* File tree area */}
        <div className="flex-1 overflow-y-auto px-2" role="tree" data-tree-root>
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

          {/* Company filter pills (shown when multiple companies exist) */}
          {hasCompanies && companyIds.length > 1 && (
            <CompanyFilterBar
              companyIds={companyIds}
              tierGroups={tierGroups}
              activeFilter={companyFilter}
              onFilterChange={onCompanyFilterChange}
            />
          )}

          {/* File tree grouped by tier */}
          {hasTiers && (
            <div className="space-y-1 py-1">
              {filteredTierGroups.map((group) => (
                <TierSection
                  key={group.companyId ? `company-${group.companyId}` : group.tier}
                  group={group}
                  onSelectFile={onSelectFile}
                  selectedFile={selectedFile}
                />
              ))}
            </div>
          )}

          {/* Fallback: ungrouped tree */}
          {!hasTiers && tree.length > 0 && (
            <div className="space-y-0.5 py-1" role="group">
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
              title={`Settings (${modifierKeyLabel()}+,)`}
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
 * Collapsible section for a tier group.
 * Supports both generic tiers (HQ Knowledge, Tools) and per-company sub-groups.
 * Per-company groups use their distinct accent color dot from group.dotColor.
 */
function TierSection({ group, onSelectFile, selectedFile }: TierSectionProps) {
  const [expanded, setExpanded] = useState(true);

  const tierDotColors: Record<string, string> = {
    hq: "bg-primary",
    company: "bg-emerald-400",
    tools: "bg-amber-400",
  };

  // Use per-company dot color if available, otherwise fall back to tier default
  const dotColor = group.dotColor || tierDotColors[group.tier] || "bg-white/30";

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
            dotColor,
          )}
        />
        <span className="flex-1">{group.label}</span>
        {group.companyId && (
          <span className="shrink-0 text-[9px] text-white/20">
            {group.roots.reduce((sum, r) => sum + r.fileCount, 0)}
          </span>
        )}
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
// CompanyFilterBar — click-to-filter by company
// ---------------------------------------------------------------------------

interface CompanyFilterBarProps {
  companyIds: string[];
  tierGroups: TierGroup[];
  activeFilter: string | null;
  onFilterChange?: (companyId: string | null) => void;
}

/**
 * Horizontal row of company color dots for quick filtering.
 * Clicking a dot filters the sidebar to only show that company's knowledge.
 * Clicking the active dot again clears the filter (shows all).
 */
function CompanyFilterBar({
  companyIds,
  tierGroups,
  activeFilter,
  onFilterChange,
}: CompanyFilterBarProps) {
  // Build dot info from tier groups
  const companyDots = companyIds.map((id) => {
    const group = tierGroups.find(
      (g) => g.tier === "company" && g.companyId === id,
    );
    return {
      id,
      label: group?.label || id,
      dotColor: group?.dotColor || "bg-white/40",
    };
  });

  return (
    <div className="mx-3 mb-1 flex items-center gap-1.5 border-b border-white/5 pb-2 pt-1">
      <span className="text-[9px] text-white/25 uppercase tracking-wider mr-1">
        Filter
      </span>
      {companyDots.map((dot) => {
        const isActive = activeFilter === dot.id;
        return (
          <button
            key={dot.id}
            onClick={() =>
              onFilterChange?.(isActive ? null : dot.id)
            }
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded-full",
              "transition-all duration-150",
              isActive
                ? "ring-1 ring-white/30 scale-110"
                : "opacity-60 hover:opacity-100 hover:scale-110",
            )}
            title={isActive ? `Clear filter (${dot.label})` : `Filter: ${dot.label}`}
          >
            <span
              className={cn(
                "block h-2.5 w-2.5 rounded-full",
                dot.dotColor,
              )}
            />
          </button>
        );
      })}
      {activeFilter && (
        <button
          onClick={() => onFilterChange?.(null)}
          className={cn(
            "ml-auto text-[9px] text-white/30 transition-colors duration-150",
            "hover:text-white/60",
          )}
        >
          Clear
        </button>
      )}
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
 * Helper: find the next focusable tree-item button relative to the current one.
 * Walks up/down through all visible `[role="treeitem"]` buttons in DOM order.
 */
function focusSiblingTreeItem(
  current: HTMLElement,
  direction: "up" | "down",
): void {
  // Collect all visible treeitem buttons in the sidebar scroll area
  const container = current.closest("[data-tree-root]");
  if (!container) return;

  const items = Array.from(
    container.querySelectorAll<HTMLButtonElement>('button[role="treeitem"]'),
  );
  const idx = items.indexOf(current as HTMLButtonElement);
  if (idx < 0) return;

  const nextIdx = direction === "down" ? idx + 1 : idx - 1;
  if (nextIdx >= 0 && nextIdx < items.length) {
    items[nextIdx].focus();
  }
}

/**
 * Recursive tree node component for rendering directories and files.
 * Directories have smooth expand/collapse animation.
 * Clicking a directory expands it AND navigates to its INDEX.md landing page.
 *
 * Keyboard navigation (when focused):
 * - ArrowUp/ArrowDown: move focus to prev/next visible tree item
 * - ArrowRight: expand directory (or move into first child)
 * - ArrowLeft: collapse directory (or move to parent)
 * - Enter/Space: open file or toggle directory
 */
function TreeNode({
  node,
  onSelectFile,
  selectedFile,
  defaultExpanded = false,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isActive = !node.isDirectory && selectedFile === node.path;
  // Highlight directory when its INDEX.md is being viewed
  const isDirActive =
    node.isDirectory &&
    typeof selectedFile === "string" &&
    selectedFile === node.path + "/INDEX.md";

  const handleClick = useCallback(() => {
    if (node.isDirectory) {
      setExpanded((prev) => !prev);
      // Also navigate to the directory's INDEX.md landing page
      if (onSelectFile) {
        onSelectFile(node.path + "/INDEX.md");
      }
    } else if (onSelectFile) {
      onSelectFile(node.path);
    }
  }, [node, onSelectFile]);

  // Keyboard navigation for tree items
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          focusSiblingTreeItem(e.currentTarget, "down");
          break;

        case "ArrowUp":
          e.preventDefault();
          focusSiblingTreeItem(e.currentTarget, "up");
          break;

        case "ArrowRight":
          e.preventDefault();
          if (node.isDirectory) {
            if (!expanded) {
              setExpanded(true);
            } else {
              // Already expanded — move focus to first child
              focusSiblingTreeItem(e.currentTarget, "down");
            }
          }
          break;

        case "ArrowLeft":
          e.preventDefault();
          if (node.isDirectory && expanded) {
            setExpanded(false);
          } else {
            // Move to parent (previous item at shallower depth)
            focusSiblingTreeItem(e.currentTarget, "up");
          }
          break;

        case "Enter":
          e.preventDefault();
          handleClick();
          break;
      }
    },
    [node, expanded, handleClick],
  );

  // Display name: use title for files if available, otherwise name
  const displayName = !node.isDirectory && node.title ? node.title : node.name;

  return (
    <div>
      <button
        role="treeitem"
        aria-expanded={node.isDirectory ? expanded : undefined}
        aria-selected={isActive || isDirActive}
        tabIndex={isActive || isDirActive ? 0 : -1}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs",
          "transition-colors duration-150",
          isActive || isDirActive
            ? "border-l-2 border-primary bg-white/5 text-foreground"
            : "border-l-2 border-transparent text-white/60 hover:bg-white/5 hover:text-white/80",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-white/5",
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
          <div className="space-y-0.5" role="group">
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

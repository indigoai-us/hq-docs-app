import { FolderOpen, FileText, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileTreeNode } from "@/lib/scanner";

interface DirectoryListingPageProps {
  /** The directory tree node with children to display */
  node: FileTreeNode;
  /** Callback when user clicks a card to navigate */
  onNavigate?: (absolutePath: string) => void;
  className?: string;
}

/**
 * Auto-generated directory listing page for directories without an INDEX.md.
 *
 * Renders child items as glass-styled clickable cards with file/directory icons,
 * titles extracted from markdown headings, and file counts for directories.
 * Directories are listed first, then files, both sorted alphabetically.
 */
export function DirectoryListingPage({
  node,
  onNavigate,
  className,
}: DirectoryListingPageProps) {
  // Sort children: directories first, then files, alphabetically within each
  const sortedChildren = [...node.children].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  const handleCardClick = (child: FileTreeNode) => {
    if (!onNavigate) return;

    if (child.isDirectory) {
      // Try to navigate to the directory's INDEX.md
      onNavigate(`${child.path}/INDEX.md`);
    } else {
      onNavigate(child.path);
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {node.name}
        </h1>
        <p className="mt-1.5 text-sm text-white/40">
          {node.fileCount} {node.fileCount === 1 ? "file" : "files"}
          {" in this directory"}
        </p>
      </div>

      {/* Cards grid */}
      {sortedChildren.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {sortedChildren.map((child) => (
            <DirectoryCard
              key={child.path}
              node={child}
              onClick={() => handleCardClick(child)}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-white/30">This directory is empty.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DirectoryCard component
// ---------------------------------------------------------------------------

interface DirectoryCardProps {
  node: FileTreeNode;
  onClick: () => void;
}

/**
 * Glass-styled clickable card for a directory child item.
 * Shows icon, name/title, and file count for directories.
 */
function DirectoryCard({ node, onClick }: DirectoryCardProps) {
  const displayName = !node.isDirectory && node.title ? node.title : node.name;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl p-4 text-left",
        "border border-white/5 bg-white/[0.03]",
        "transition-all duration-150 ease-in-out",
        "hover:border-white/10 hover:bg-white/[0.06]",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          node.isDirectory ? "bg-primary/10" : "bg-white/5",
        )}
      >
        {node.isDirectory ? (
          <FolderOpen className="h-4 w-4 text-primary" />
        ) : (
          <FileText className="h-4 w-4 text-white/40" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {displayName}
        </span>
        {node.isDirectory && node.fileCount > 0 && (
          <span className="text-xs text-white/30">
            {node.fileCount} {node.fileCount === 1 ? "file" : "files"}
          </span>
        )}
        {!node.isDirectory && node.name !== displayName && (
          <span className="block truncate text-xs text-white/30">
            {node.name}
          </span>
        )}
      </div>

      <ChevronRight
        className={cn(
          "h-4 w-4 shrink-0 text-white/20",
          "transition-transform duration-150",
          "group-hover:translate-x-0.5 group-hover:text-white/40",
        )}
      />
    </button>
  );
}

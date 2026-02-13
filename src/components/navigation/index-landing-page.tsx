import { useMemo } from "react";
import { FolderOpen, FileText, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  parseIndexMd,
  getStatusColor,
  type IndexEntry,
} from "@/lib/index-md-parser";

interface IndexLandingPageProps {
  /** Raw INDEX.md content */
  content: string;
  /** Absolute directory path containing this INDEX.md */
  directoryPath: string;
  /** Callback when user clicks a card to navigate */
  onNavigate?: (absolutePath: string) => void;
  className?: string;
}

/**
 * Renders an INDEX.md file as a card-based landing page.
 *
 * Parses the INDEX.md table rows into glass-styled clickable cards
 * with title, description, and optional status/progress badges.
 * Supports nested hierarchy navigation (click through to child items).
 */
export function IndexLandingPage({
  content,
  directoryPath,
  onNavigate,
  className,
}: IndexLandingPageProps) {
  const parsed = useMemo(() => parseIndexMd(content), [content]);

  if (!parsed) {
    return null;
  }

  const handleCardClick = (entry: IndexEntry) => {
    if (!onNavigate) return;

    if (entry.isDirectory) {
      // Navigate to the directory's INDEX.md
      onNavigate(`${directoryPath}/${entry.name}/INDEX.md`);
    } else {
      // Navigate directly to the file
      const fileName = entry.name.endsWith(".md")
        ? entry.name
        : `${entry.name}.md`;
      onNavigate(`${directoryPath}/${fileName}`);
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {parsed.title}
        </h1>
        {parsed.subtitle && (
          <p className="mt-1.5 text-sm text-white/40">{parsed.subtitle}</p>
        )}
      </div>

      {/* Cards grid */}
      {parsed.entries.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {parsed.entries.map((entry) => (
            <EntryCard
              key={entry.name}
              entry={entry}
              onClick={() => handleCardClick(entry)}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-white/30">No entries found in index.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EntryCard component
// ---------------------------------------------------------------------------

interface EntryCardProps {
  entry: IndexEntry;
  onClick: () => void;
}

/**
 * Glass-styled clickable card for an INDEX.md entry.
 * Shows icon, title, description, and optional status/progress badge.
 */
function EntryCard({ entry, onClick }: EntryCardProps) {
  const statusStyle = entry.status ? getStatusColor(entry.status) : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex w-full flex-col gap-2 rounded-xl p-4 text-left",
        "border border-white/5 bg-white/[0.03]",
        "transition-all duration-150 ease-in-out",
        "hover:border-white/10 hover:bg-white/[0.06]",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
      )}
    >
      {/* Top row: icon + name + navigate arrow */}
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            entry.isDirectory ? "bg-primary/10" : "bg-white/5",
          )}
        >
          {entry.isDirectory ? (
            <FolderOpen className="h-4 w-4 text-primary" />
          ) : (
            <FileText className="h-4 w-4 text-white/40" />
          )}
        </div>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {entry.name}
        </span>
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 text-white/20",
            "transition-transform duration-150",
            "group-hover:translate-x-0.5 group-hover:text-white/40",
          )}
        />
      </div>

      {/* Description */}
      {entry.description && (
        <p className="line-clamp-2 text-xs leading-relaxed text-white/50">
          {entry.description}
        </p>
      )}

      {/* Badges row: status, progress, date */}
      {(entry.status || entry.progress || entry.date) && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {entry.status && statusStyle && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
                statusStyle.bg,
                statusStyle.text,
              )}
            >
              <span
                className={cn("h-1.5 w-1.5 rounded-full", statusStyle.dot)}
              />
              {entry.status}
            </span>
          )}
          {entry.progress && (
            <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/50">
              {entry.progress}
            </span>
          )}
          {entry.date && (
            <span className="text-[10px] text-white/30">{entry.date}</span>
          )}
        </div>
      )}
    </button>
  );
}

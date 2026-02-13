/**
 * Cmd+K command palette with glass-styled search UI.
 *
 * Features:
 * - Three search modes: keyword, semantic, hybrid
 * - Collection scoping dropdown
 * - Keyboard navigation (arrows, Enter, Escape)
 * - Debounced input with loading states
 * - qmd unavailable fallback message
 */

import { useEffect, useRef, useCallback, useState } from "react";
import {
  Search,
  X,
  Loader2,
  FileText,
  AlertCircle,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { cn } from "@/lib/utils";
import {
  useSearch,
  type SearchMode,
  type SearchResult,
} from "@/hooks/use-search";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandPaletteProps {
  /** Whether the palette is visible */
  isOpen: boolean;
  /** Close callback */
  onClose: () => void;
  /** Callback when user selects a result (absolute file path) */
  onSelectFile: (filePath: string) => void;
  /** HQ folder path for resolving relative paths from qmd results */
  hqFolderPath: string | null;
}

// ---------------------------------------------------------------------------
// Search mode config
// ---------------------------------------------------------------------------

const MODE_OPTIONS: Array<{
  value: SearchMode;
  label: string;
  description: string;
}> = [
  { value: "hybrid", label: "Hybrid", description: "Best quality, slower" },
  { value: "keyword", label: "Keyword", description: "Fast exact match" },
  {
    value: "semantic",
    label: "Semantic",
    description: "Conceptual similarity",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette({
  isOpen,
  onClose,
  onSelectFile,
  hqFolderPath,
}: CommandPaletteProps) {
  const {
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
  } = useSearch();

  const [activeIndex, setActiveIndex] = useState(-1);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [showCollectionDropdown, setShowCollectionDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const modeDropdownRef = useRef<HTMLDivElement>(null);
  const collectionDropdownRef = useRef<HTMLDivElement>(null);

  // Focus input when palette opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the element is mounted
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // When the palette closes, clear search state on next open
  const handleClose = useCallback(() => {
    clear();
    setActiveIndex(-1);
    setShowModeDropdown(false);
    setShowCollectionDropdown(false);
    onClose();
  }, [clear, onClose]);

  // Reset active index when results change — use a version counter
  // that we increment via a wrapper around setQuery
  const handleSetQuery = useCallback(
    (q: string) => {
      setQuery(q);
      // Reset index whenever query changes
      setActiveIndex(0);
    },
    [setQuery],
  );

  // Derive: clamp activeIndex to valid range whenever results change.
  // This replaces an effect-based approach to avoid synchronous setState in effects.
  const clampedActiveIndex =
    results.length === 0
      ? -1
      : activeIndex >= results.length
        ? results.length - 1
        : activeIndex < 0 && results.length > 0
          ? 0
          : activeIndex;

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        modeDropdownRef.current &&
        !modeDropdownRef.current.contains(e.target as Node)
      ) {
        setShowModeDropdown(false);
      }
      if (
        collectionDropdownRef.current &&
        !collectionDropdownRef.current.contains(e.target as Node)
      ) {
        setShowCollectionDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Handle selecting a result
  const handleSelect = useCallback(
    (result: SearchResult) => {
      // Resolve the file path — qmd returns paths relative to the collection root
      // Try to build an absolute path using hqFolderPath
      let absolutePath = result.filePath;

      if (hqFolderPath && !absolutePath.startsWith("/")) {
        absolutePath = `${hqFolderPath}/${result.filePath}`;
      }

      onSelectFile(absolutePath);
      handleClose();
    },
    [hqFolderPath, onSelectFile, handleClose],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Don't handle keys when dropdown is open
      if (showModeDropdown || showCollectionDropdown) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : prev,
          );
          break;

        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;

        case "Enter":
          e.preventDefault();
          if (clampedActiveIndex >= 0 && clampedActiveIndex < results.length) {
            handleSelect(results[clampedActiveIndex]);
          }
          break;

        case "Escape":
          e.preventDefault();
          if (query) {
            clear();
            setActiveIndex(-1);
          } else {
            handleClose();
          }
          break;
      }
    },
    [
      results,
      clampedActiveIndex,
      query,
      showModeDropdown,
      showCollectionDropdown,
      handleSelect,
      clear,
      handleClose,
    ],
  );

  // Scroll active item into view
  useEffect(() => {
    if (clampedActiveIndex < 0) return;
    const list = listRef.current;
    if (!list) return;
    const item = list.children[clampedActiveIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [clampedActiveIndex]);

  if (!isOpen) return null;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {/* Backdrop blur overlay */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Palette container */}
      <GlassPanel
        variant="overlay"
        className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden"
        style={{ maxHeight: "70vh" }}
      >
        {/* Search input row */}
        <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
          ) : (
            <Search className="h-4 w-4 shrink-0 text-white/40" />
          )}

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleSetQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              qmdStatus === "unavailable"
                ? "Search unavailable — qmd not installed"
                : "Search docs..."
            }
            disabled={qmdStatus === "unavailable"}
            className={cn(
              "flex-1 bg-transparent text-sm text-white/90 outline-none",
              "placeholder:text-white/30",
              qmdStatus === "unavailable" && "cursor-not-allowed opacity-50",
            )}
            autoComplete="off"
            spellCheck={false}
          />

          {/* Mode selector */}
          <div ref={modeDropdownRef} className="relative">
            <button
              onClick={() => {
                setShowModeDropdown((prev) => !prev);
                setShowCollectionDropdown(false);
              }}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1",
                "text-xs text-white/50 transition-colors duration-150",
                "hover:bg-white/5 hover:text-white/70",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
              )}
              title="Search mode"
            >
              {MODE_OPTIONS.find((m) => m.value === mode)?.label}
              <ChevronDown className="h-3 w-3" />
            </button>

            {showModeDropdown && (
              <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-white/10 bg-[rgba(25,25,25,0.95)] py-1 shadow-xl backdrop-blur-2xl">
                {MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setMode(opt.value);
                      setShowModeDropdown(false);
                      inputRef.current?.focus();
                    }}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2 text-left",
                      "transition-colors duration-100",
                      "hover:bg-white/5",
                      mode === opt.value && "bg-white/[0.03]",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                        mode === opt.value ? "bg-primary" : "bg-white/20",
                      )}
                    />
                    <div>
                      <p className="text-xs font-medium text-white/80">
                        {opt.label}
                      </p>
                      <p className="text-[10px] text-white/40">
                        {opt.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Collection selector */}
          {collections.length > 0 && (
            <div ref={collectionDropdownRef} className="relative">
              <button
                onClick={() => {
                  setShowCollectionDropdown((prev) => !prev);
                  setShowModeDropdown(false);
                }}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1",
                  "text-xs text-white/50 transition-colors duration-150",
                  "hover:bg-white/5 hover:text-white/70",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                )}
                title="Search collection"
              >
                {collection === "all" ? "All" : collection}
                <ChevronDown className="h-3 w-3" />
              </button>

              {showCollectionDropdown && (
                <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-white/10 bg-[rgba(25,25,25,0.95)] py-1 shadow-xl backdrop-blur-2xl">
                  <button
                    onClick={() => {
                      setCollection("all");
                      setShowCollectionDropdown(false);
                      inputRef.current?.focus();
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-xs",
                      "transition-colors duration-100 hover:bg-white/5",
                      collection === "all" && "bg-white/[0.03]",
                    )}
                  >
                    <div
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        collection === "all" ? "bg-primary" : "bg-white/20",
                      )}
                    />
                    <span className="text-white/80">All Collections</span>
                  </button>
                  {collections.map((coll) => (
                    <button
                      key={coll}
                      onClick={() => {
                        setCollection(coll);
                        setShowCollectionDropdown(false);
                        inputRef.current?.focus();
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-xs",
                        "transition-colors duration-100 hover:bg-white/5",
                        collection === coll && "bg-white/[0.03]",
                      )}
                    >
                      <div
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          collection === coll ? "bg-primary" : "bg-white/20",
                        )}
                      />
                      <span className="text-white/80">{coll}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Close button */}
          {query && (
            <button
              onClick={clear}
              className="flex h-5 w-5 items-center justify-center rounded text-white/30 transition-colors hover:text-white/60"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* qmd unavailable message */}
        {qmdStatus === "unavailable" && (
          <div className="flex items-center gap-3 px-4 py-6">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-400/60" />
            <div>
              <p className="text-sm font-medium text-white/70">
                Install qmd for search
              </p>
              <p className="mt-1 text-xs text-white/40">
                qmd provides keyword, semantic, and hybrid search across your
                docs.
              </p>
              <a
                href="https://github.com/tobi/qmd"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-primary/80 transition-colors hover:text-primary"
              >
                Learn more
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

        {/* Results area */}
        {qmdStatus !== "unavailable" && (
          <div className="flex-1 overflow-y-auto" ref={listRef}>
            {/* Result count */}
            {query && !loading && results.length > 0 && (
              <div className="px-4 pb-1 pt-2">
                <span className="text-[10px] text-white/30">
                  {total} result{total !== 1 ? "s" : ""} for &ldquo;{query}
                  &rdquo;
                  {collection !== "all" ? ` in ${collection}` : ""}
                </span>
              </div>
            )}

            {/* Results list */}
            {results.map((result, idx) => (
              <SearchResultItem
                key={`${result.filePath}-${idx}`}
                result={result}
                isActive={idx === clampedActiveIndex}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setActiveIndex(idx)}
              />
            ))}

            {/* Loading state (no results yet) */}
            {loading && results.length === 0 && query && (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary/50" />
                  <span className="text-xs text-white/30">Searching...</span>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!loading && query && results.length === 0 && !error && (
              <div className="flex flex-col items-center py-8">
                <Search className="h-5 w-5 text-white/15" />
                <p className="mt-2 text-xs text-white/40">
                  No results for &ldquo;{query}&rdquo;
                  {collection !== "all" ? ` in ${collection}` : ""}
                </p>
                <p className="mt-1 text-[10px] text-white/25">
                  Try a different search mode or broader collection
                </p>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="flex items-center gap-2 px-4 py-4">
                <AlertCircle className="h-4 w-4 shrink-0 text-destructive/60" />
                <p className="text-xs text-destructive/80">{error}</p>
              </div>
            )}

            {/* Placeholder when no query */}
            {!query && !loading && (
              <div className="flex flex-col items-center py-8">
                <Search className="h-5 w-5 text-white/10" />
                <p className="mt-2 text-xs text-white/30">
                  Type to search across your docs
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <KeyHint keys={["↑", "↓"]} label="navigate" />
                  <KeyHint keys={["↵"]} label="open" />
                  <KeyHint keys={["esc"]} label="close" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer with keyboard hints */}
        {qmdStatus !== "unavailable" && (query || results.length > 0) && (
          <div className="flex items-center gap-4 border-t border-white/5 px-4 py-2">
            <KeyHint keys={["↑", "↓"]} label="navigate" />
            <KeyHint keys={["↵"]} label="open" />
            <KeyHint keys={["esc"]} label={query ? "clear" : "close"} />
          </div>
        )}
      </GlassPanel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search result item
// ---------------------------------------------------------------------------

interface SearchResultItemProps {
  result: SearchResult;
  isActive: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

function SearchResultItem({
  result,
  isActive,
  onClick,
  onMouseEnter,
}: SearchResultItemProps) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        "flex w-full items-start gap-3 px-4 py-2.5 text-left",
        "transition-colors duration-100",
        isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.03]",
      )}
    >
      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />

      <div className="min-w-0 flex-1">
        {/* Title */}
        <p className="truncate text-sm font-medium text-white/90">
          {result.title}
        </p>

        {/* File path */}
        <p className="mt-0.5 truncate font-mono text-[10px] text-white/35">
          {result.filePath}
        </p>

        {/* Snippet */}
        {result.snippet && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/50">
            {result.snippet}
          </p>
        )}
      </div>

      {/* Score bar */}
      <div className="mt-1 flex shrink-0 flex-col items-end gap-1">
        <div
          className="h-1 w-8 overflow-hidden rounded-full bg-white/10"
          title={`Relevance: ${Math.round(result.score * 100)}%`}
          role="img"
          aria-label={`Relevance: ${Math.round(result.score * 100)}%`}
        >
          <div
            className="h-full rounded-full bg-emerald-400/60 transition-all"
            style={{ width: `${Math.max(result.score * 100, 5)}%` }}
          />
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Keyboard hint badge
// ---------------------------------------------------------------------------

function KeyHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center gap-1">
      {keys.map((key) => (
        <kbd
          key={key}
          className="inline-flex h-4 min-w-[16px] items-center justify-center rounded border border-white/10 bg-white/5 px-1 text-[10px] text-white/40"
        >
          {key}
        </kbd>
      ))}
      <span className="text-[10px] text-white/25">{label}</span>
    </div>
  );
}

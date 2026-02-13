import { useState, useEffect, useCallback } from "react";
import { List } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassPanel } from "@/components/ui/glass-panel";
import type { TocItem } from "@/lib/markdown-utils";

interface TableOfContentsProps {
  items: TocItem[];
  className?: string;
}

/**
 * Right-side floating table of contents panel with glass styling.
 * Auto-generated from headings in the rendered markdown.
 * Highlights the currently active section on scroll.
 */
export function TableOfContents({ items, className }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");
  const [collapsed, setCollapsed] = useState(false);

  // Track which heading is currently in view
  useEffect(() => {
    if (items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first visible heading
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-80px 0px -60% 0px",
        threshold: 0,
      },
    );

    // Observe all heading elements
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [items]);

  const handleClick = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
    }
  }, []);

  if (items.length < 2) return null;

  const minLevel = Math.min(...items.map((i) => i.level));

  return (
    <GlassPanel
      variant="subtle"
      className={cn(
        "sticky top-24 w-56 shrink-0 self-start",
        collapsed && "w-auto",
        className,
      )}
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed((prev) => !prev)}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-white/50",
          "transition-colors duration-150 hover:text-white/70",
        )}
      >
        <List className="h-3.5 w-3.5" />
        {!collapsed && <span>On this page</span>}
      </button>

      {/* TOC items */}
      {!collapsed && (
        <nav className="px-2 pb-3">
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => handleClick(item.id)}
                  className={cn(
                    "block w-full truncate rounded-sm px-2 py-1 text-left text-xs",
                    "transition-colors duration-150",
                    activeId === item.id
                      ? "bg-primary/10 text-primary"
                      : "text-white/40 hover:bg-white/5 hover:text-white/60",
                  )}
                  style={{
                    paddingLeft: `${(item.level - minLevel) * 12 + 8}px`,
                  }}
                >
                  {item.text}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </GlassPanel>
  );
}

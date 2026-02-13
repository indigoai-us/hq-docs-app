import { useState, useEffect, useCallback, useRef } from "react";
import { Check, Copy } from "lucide-react";
import { codeToHtml } from "shiki";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  children: string;
  language?: string;
  className?: string;
}

/**
 * Syntax-highlighted code block with copy button.
 * Uses shiki for server-quality syntax highlighting with a dark theme.
 */
export function CodeBlock({ children, language, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Syntax highlight via shiki
  useEffect(() => {
    let cancelled = false;

    async function highlight() {
      if (!children.trim()) return;

      try {
        const html = await codeToHtml(children, {
          lang: language || "text",
          theme: "github-dark-default",
        });
        if (!cancelled) {
          setHighlightedHtml(html);
        }
      } catch {
        // If language isn't supported, fall back to plain text
        try {
          const html = await codeToHtml(children, {
            lang: "text",
            theme: "github-dark-default",
          });
          if (!cancelled) {
            setHighlightedHtml(html);
          }
        } catch {
          // Total fallback - no highlighting
          if (!cancelled) {
            setHighlightedHtml(null);
          }
        }
      }
    }

    highlight();
    return () => {
      cancelled = true;
    };
  }, [children, language]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [children]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className={cn("group relative my-4 rounded-lg border border-white/5", className)}>
      {/* Language label + copy button */}
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-1.5">
        <span className="text-xs text-white/30 font-mono">
          {language || "text"}
        </span>
        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs",
            "transition-all duration-150",
            copied
              ? "text-emerald-400"
              : "text-white/30 opacity-0 group-hover:opacity-100 hover:text-white/60",
          )}
          aria-label={copied ? "Copied!" : "Copy code"}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <div className="overflow-x-auto">
        {highlightedHtml ? (
          <div
            className="shiki-container p-4 text-sm leading-relaxed [&_pre]:!bg-transparent [&_pre]:!p-0 [&_code]:!bg-transparent"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <pre className="p-4 text-sm leading-relaxed">
            <code className="text-white/70 font-mono">{children}</code>
          </pre>
        )}
      </div>
    </div>
  );
}

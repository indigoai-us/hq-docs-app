import { useMemo, type ComponentPropsWithoutRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import { cn } from "@/lib/utils";
import { CodeBlock } from "@/components/markdown/code-block";
import { ChartBlock } from "@/components/markdown/chart-block";
import { MermaidDiagram } from "@/components/markdown/mermaid-diagram";
import { TableOfContents } from "@/components/markdown/table-of-contents";
import { extractTocItems } from "@/lib/markdown-utils";

interface MarkdownRendererProps {
  /** Raw markdown content string */
  content: string;
  /** Base directory path for resolving relative image/link paths */
  basePath?: string;
  /** Callback when a relative .md link is clicked (in-app navigation) */
  onNavigate?: (relativePath: string) => void;
  /** Whether to show the table of contents */
  showToc?: boolean;
  className?: string;
}

/**
 * Full GFM markdown renderer with syntax highlighting, table of contents,
 * copy-on-code-blocks, and in-app navigation for relative links.
 *
 * Features:
 * - All GFM features: tables, task lists, strikethrough, footnotes, autolinks
 * - Shiki syntax highlighting for code blocks
 * - Auto-generated table of contents from headings (right-side floating panel)
 * - Copy button on code blocks
 * - Relative .md links resolve to in-app navigation
 * - Images loaded from filesystem via Tauri asset protocol
 * - Comfortable reading typography (max-width 768px, relaxed line-height)
 * - Indigo accent for links and headings
 */
export function MarkdownRenderer({
  content,
  basePath,
  onNavigate,
  showToc = true,
  className,
}: MarkdownRendererProps) {
  const tocItems = useMemo(() => extractTocItems(content), [content]);

  return (
    <div className={cn("flex gap-6", className)}>
      {/* Main content area */}
      <article className="markdown-body min-w-0 max-w-3xl flex-1">
        <Markdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeSlug]}
          components={{
            // Headings with Indigo accent and anchor links
            h1: ({ children, id, ...props }) => (
              <h1
                id={id}
                className="mb-4 mt-8 text-3xl font-bold tracking-tight text-foreground first:mt-0"
                {...props}
              >
                {children}
              </h1>
            ),
            h2: ({ children, id, ...props }) => (
              <h2
                id={id}
                className="mb-3 mt-8 border-b border-white/5 pb-2 text-2xl font-semibold tracking-tight text-foreground"
                {...props}
              >
                {children}
              </h2>
            ),
            h3: ({ children, id, ...props }) => (
              <h3
                id={id}
                className="mb-2 mt-6 text-xl font-semibold text-foreground"
                {...props}
              >
                {children}
              </h3>
            ),
            h4: ({ children, id, ...props }) => (
              <h4
                id={id}
                className="mb-2 mt-4 text-lg font-semibold text-foreground"
                {...props}
              >
                {children}
              </h4>
            ),
            h5: ({ children, id, ...props }) => (
              <h5
                id={id}
                className="mb-1 mt-4 text-base font-semibold text-foreground"
                {...props}
              >
                {children}
              </h5>
            ),
            h6: ({ children, id, ...props }) => (
              <h6
                id={id}
                className="mb-1 mt-4 text-sm font-semibold text-white/70"
                {...props}
              >
                {children}
              </h6>
            ),

            // Paragraphs
            p: ({ children, ...props }) => (
              <p
                className="my-3 text-sm leading-relaxed text-white/70"
                {...props}
              >
                {children}
              </p>
            ),

            // Links - resolve relative .md to in-app navigation
            a: ({ href, children, ...props }) => {
              const isRelativeMd =
                href &&
                !href.startsWith("http") &&
                !href.startsWith("#") &&
                (href.endsWith(".md") || href.includes(".md#"));

              if (isRelativeMd && onNavigate) {
                return (
                  <button
                    className="text-primary transition-colors duration-150 hover:text-primary/80 hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(href);
                    }}
                    {...(props as ComponentPropsWithoutRef<"button">)}
                  >
                    {children}
                  </button>
                );
              }

              // Anchor links (scroll to heading)
              if (href?.startsWith("#")) {
                return (
                  <a
                    href={href}
                    className="text-primary transition-colors duration-150 hover:text-primary/80 hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      const id = href.slice(1);
                      const el = document.getElementById(id);
                      if (el)
                        el.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                    }}
                    {...props}
                  >
                    {children}
                  </a>
                );
              }

              // External links
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary transition-colors duration-150 hover:text-primary/80 hover:underline"
                  {...props}
                >
                  {children}
                </a>
              );
            },

            // Code blocks (with syntax highlighting)
            pre: ({ children }) => {
              // react-markdown wraps code blocks in <pre><code>
              // We extract the code content and language from the child <code> element
              return <>{children}</>;
            },
            code: ({ className: codeClassName, children, ...props }) => {
              const match = /language-(\w+)/.exec(codeClassName || "");
              const isBlock =
                props.node?.position?.start.line !==
                props.node?.position?.end.line;
              const content = String(children).replace(/\n$/, "");

              // Mermaid diagrams get rendered as interactive SVG
              if (match?.[1] === "mermaid") {
                return <MermaidDiagram chart={content} />;
              }

              // Chart blocks get rendered as Recharts visualizations
              if (match?.[1] === "chart") {
                return <ChartBlock>{content}</ChartBlock>;
              }

              // Multi-line code blocks get full CodeBlock treatment
              if (match || isBlock || content.includes("\n")) {
                return (
                  <CodeBlock language={match?.[1]}>{content}</CodeBlock>
                );
              }

              // Inline code
              return (
                <code className="rounded-sm bg-white/10 px-1.5 py-0.5 text-xs font-mono text-primary/90">
                  {children}
                </code>
              );
            },

            // Blockquotes
            blockquote: ({ children, ...props }) => (
              <blockquote
                className="my-4 border-l-2 border-primary/30 pl-4 text-white/50 italic"
                {...props}
              >
                {children}
              </blockquote>
            ),

            // Lists
            ul: ({ children, ...props }) => (
              <ul
                className="my-3 list-disc space-y-1 pl-6 text-sm text-white/70"
                {...props}
              >
                {children}
              </ul>
            ),
            ol: ({ children, ...props }) => (
              <ol
                className="my-3 list-decimal space-y-1 pl-6 text-sm text-white/70"
                {...props}
              >
                {children}
              </ol>
            ),
            li: ({ children, ...props }) => {
              // Handle task list items (GFM)
              const node = props.node;
              const isTaskItem =
                node &&
                "checked" in node &&
                typeof (node as { checked?: boolean | null }).checked ===
                  "boolean";

              if (isTaskItem) {
                const checked = (node as { checked: boolean }).checked;
                return (
                  <li className="flex items-start gap-2 list-none -ml-6" {...props}>
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        checked
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-white/20 bg-white/5",
                      )}
                    >
                      {checked && (
                        <svg
                          className="h-3 w-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </span>
                    <span className={cn(checked && "text-white/40 line-through")}>
                      {children}
                    </span>
                  </li>
                );
              }

              return (
                <li className="leading-relaxed" {...props}>
                  {children}
                </li>
              );
            },

            // Tables
            table: ({ children, ...props }) => (
              <div className="my-4 overflow-x-auto rounded-lg border border-white/5">
                <table
                  className="w-full text-sm"
                  {...props}
                >
                  {children}
                </table>
              </div>
            ),
            thead: ({ children, ...props }) => (
              <thead className="border-b border-white/10 bg-white/5" {...props}>
                {children}
              </thead>
            ),
            tbody: ({ children, ...props }) => (
              <tbody className="divide-y divide-white/5" {...props}>
                {children}
              </tbody>
            ),
            tr: ({ children, ...props }) => (
              <tr
                className="transition-colors duration-150 hover:bg-white/[0.02]"
                {...props}
              >
                {children}
              </tr>
            ),
            th: ({ children, ...props }) => (
              <th
                className="px-4 py-2 text-left text-xs font-medium text-white/60"
                {...props}
              >
                {children}
              </th>
            ),
            td: ({ children, ...props }) => (
              <td className="px-4 py-2 text-white/70" {...props}>
                {children}
              </td>
            ),

            // Horizontal rule
            hr: (props) => (
              <hr className="my-6 border-white/5" {...props} />
            ),

            // Strong / emphasis / strikethrough
            strong: ({ children, ...props }) => (
              <strong className="font-semibold text-foreground" {...props}>
                {children}
              </strong>
            ),
            em: ({ children, ...props }) => (
              <em className="italic text-white/60" {...props}>
                {children}
              </em>
            ),
            del: ({ children, ...props }) => (
              <del className="text-white/30 line-through" {...props}>
                {children}
              </del>
            ),

            // Images - resolve from filesystem via Tauri asset protocol
            img: ({ src, alt, ...props }) => {
              let resolvedSrc = src || "";

              // Resolve relative image paths against basePath
              if (
                basePath &&
                src &&
                !src.startsWith("http") &&
                !src.startsWith("data:") &&
                !src.startsWith("asset:")
              ) {
                // Use Tauri's convertFileSrc-compatible path
                resolvedSrc = `${basePath}/${src}`;
              }

              return (
                <img
                  src={resolvedSrc}
                  alt={alt || ""}
                  className="my-4 max-w-full rounded-lg border border-white/5"
                  loading="lazy"
                  {...props}
                />
              );
            },
          }}
        >
          {content}
        </Markdown>
      </article>

      {/* Table of Contents - right-side floating panel */}
      {showToc && tocItems.length >= 2 && (
        <aside className="hidden xl:block">
          <TableOfContents items={tocItems} />
        </aside>
      )}
    </div>
  );
}

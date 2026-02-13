import {
  useState,
  useEffect,
  useRef,
  useCallback,
  Suspense,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { cn } from "@/lib/utils";
import { Maximize2, Minimize2, AlertTriangle, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

// Lazy-load mermaid only when a diagram block is encountered
const mermaidPromise = import("mermaid").then((mod) => {
  const mermaid = mod.default;
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    darkMode: true,
    themeVariables: {
      // Glass aesthetic dark backgrounds with Indigo (#4F46E5) accents
      primaryColor: "#4F46E5",
      primaryTextColor: "#e2e8f0",
      primaryBorderColor: "#6366f1",
      secondaryColor: "#1e1b4b",
      secondaryTextColor: "#e2e8f0",
      secondaryBorderColor: "#4338ca",
      tertiaryColor: "#0f172a",
      tertiaryTextColor: "#e2e8f0",
      tertiaryBorderColor: "#334155",
      lineColor: "#6366f1",
      textColor: "#e2e8f0",
      mainBkg: "#1e1b4b",
      nodeBorder: "#6366f1",
      clusterBkg: "#0f172a80",
      clusterBorder: "#4338ca",
      titleColor: "#e2e8f0",
      edgeLabelBackground: "#1e1b4b",
      nodeTextColor: "#e2e8f0",
      // Sequence diagram
      actorBkg: "#1e1b4b",
      actorBorder: "#6366f1",
      actorTextColor: "#e2e8f0",
      actorLineColor: "#6366f1",
      signalColor: "#e2e8f0",
      signalTextColor: "#e2e8f0",
      labelBoxBkgColor: "#1e1b4b",
      labelBoxBorderColor: "#6366f1",
      labelTextColor: "#e2e8f0",
      loopTextColor: "#e2e8f0",
      noteBkgColor: "#312e81",
      noteTextColor: "#e2e8f0",
      noteBorderColor: "#4338ca",
      activationBkgColor: "#312e81",
      activationBorderColor: "#6366f1",
      // State diagram
      labelColor: "#e2e8f0",
      altBackground: "#0f172a",
      // Gantt
      taskBkgColor: "#4F46E5",
      taskTextColor: "#e2e8f0",
      taskTextDarkColor: "#e2e8f0",
      taskBorderColor: "#6366f1",
      activeTaskBkgColor: "#6366f1",
      activeTaskBorderColor: "#818cf8",
      doneTaskBkgColor: "#312e81",
      doneTaskBorderColor: "#4338ca",
      critBkgColor: "#dc2626",
      critBorderColor: "#ef4444",
      gridColor: "#334155",
      todayLineColor: "#4F46E5",
      // Pie
      pie1: "#4F46E5",
      pie2: "#6366f1",
      pie3: "#818cf8",
      pie4: "#a5b4fc",
      pie5: "#c7d2fe",
      pie6: "#312e81",
      pie7: "#1e1b4b",
      pieTitleTextSize: "14px",
      pieTitleTextColor: "#e2e8f0",
      pieSectionTextSize: "12px",
      pieSectionTextColor: "#e2e8f0",
      pieLegendTextSize: "12px",
      pieLegendTextColor: "#e2e8f0",
      pieStrokeColor: "#0f172a",
      // ER diagram
      entityBkg: "#1e1b4b",
    },
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
    fontSize: 14,
    flowchart: {
      htmlLabels: true,
      curve: "basis",
      padding: 15,
    },
    sequence: {
      diagramMarginX: 16,
      diagramMarginY: 16,
      actorMargin: 60,
      messageMargin: 40,
    },
  });
  return mermaid;
});

interface MermaidDiagramProps {
  /** Raw mermaid diagram definition string */
  chart: string;
  className?: string;
}

let diagramCounter = 0;

function nextMermaidId() {
  return `mermaid-${Date.now()}-${diagramCounter++}`;
}

/**
 * Renders a mermaid diagram as an inline SVG with dark theme and Indigo accents.
 * Click-to-zoom opens a fullscreen modal with pan/zoom controls.
 * Falls back to raw code + error indicator on parse failures.
 * Lazy-loaded: mermaid.js is only fetched when this component is first rendered.
 */
function MermaidDiagramInner({ chart, className }: MermaidDiagramProps) {
  const [svgHtml, setSvgHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan/zoom state for fullscreen modal
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let cancelled = false;
    // Generate a fresh ID for each render to avoid mermaid duplicate-ID errors
    const renderId = nextMermaidId();

    async function render() {
      try {
        const mermaid = await mermaidPromise;
        const { svg } = await mermaid.render(renderId, chart.trim());
        if (!cancelled) {
          setSvgHtml(svg);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setSvgHtml(null);
        }
        // Clean up mermaid's error container if it creates one
        const errorEl = document.getElementById("d" + renderId);
        if (errorEl) errorEl.remove();
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  // Reset zoom/pan when opening fullscreen
  const openFullscreen = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    setIsFullscreen(true);
  }, []);

  const closeFullscreen = useCallback(() => {
    setIsFullscreen(false);
  }, []);

  // Keyboard escape to close fullscreen
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFullscreen();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isFullscreen, closeFullscreen]);

  // Zoom controls
  const zoomIn = useCallback(() => setScale((s) => Math.min(s * 1.25, 5)), []);
  const zoomOut = useCallback(() => setScale((s) => Math.max(s / 1.25, 0.2)), []);
  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  // Mouse wheel zoom in fullscreen
  const handleWheel = useCallback((e: ReactWheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((s) => Math.min(Math.max(s * delta, 0.2), 5));
  }, []);

  // Pan handlers for fullscreen
  const handleMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY };
      translateStart.current = { ...translate };
    },
    [translate],
  );

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent) => {
      if (!isPanning) return;
      setTranslate({
        x: translateStart.current.x + (e.clientX - panStart.current.x),
        y: translateStart.current.y + (e.clientY - panStart.current.y),
      });
    },
    [isPanning],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Error fallback: show raw code + error indicator
  if (error) {
    return (
      <div
        className={cn(
          "my-4 rounded-lg border border-amber-500/20 bg-amber-950/10",
          className,
        )}
      >
        <div className="flex items-center gap-2 border-b border-amber-500/20 px-4 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <span className="text-xs text-amber-400">
            Mermaid diagram error
          </span>
        </div>
        <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
          <code className="font-mono text-white/70">{chart}</code>
        </pre>
        <div className="border-t border-amber-500/10 px-4 py-2">
          <p className="text-xs text-amber-400/60">{error}</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (!svgHtml) {
    return (
      <div
        className={cn(
          "my-4 flex h-32 items-center justify-center rounded-lg border border-white/5 bg-white/5",
          className,
        )}
      >
        <div className="flex items-center gap-2 text-white/30">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-primary" />
          <span className="text-xs">Rendering diagram...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Inline diagram */}
      <div
        ref={containerRef}
        className={cn(
          "group relative my-4 overflow-hidden rounded-lg border border-white/5 bg-black/30",
          className,
        )}
      >
        {/* Expand button */}
        <button
          onClick={openFullscreen}
          className="absolute right-2 top-2 z-10 rounded-md bg-black/50 p-1.5 text-white/30 opacity-0 backdrop-blur-sm transition-all duration-150 hover:text-white/70 group-hover:opacity-100"
          aria-label="View fullscreen"
        >
          <Maximize2 className="h-4 w-4" />
        </button>

        {/* SVG container */}
        <div
          className="flex items-center justify-center overflow-x-auto p-6 [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      </div>

      {/* Fullscreen modal with pan/zoom */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeFullscreen();
          }}
        >
          {/* Controls bar */}
          <div className="absolute left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-white/10 bg-black/60 px-2 py-1.5 backdrop-blur-2xl">
            <button
              onClick={zoomOut}
              className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="min-w-[3rem] text-center text-xs text-white/40">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <div className="mx-1 h-4 w-px bg-white/10" />
            <button
              onClick={resetZoom}
              className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
              aria-label="Reset zoom"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <div className="mx-1 h-4 w-px bg-white/10" />
            <button
              onClick={closeFullscreen}
              className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
              aria-label="Exit fullscreen"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
          </div>

          {/* Pannable/zoomable SVG area */}
          <div
            className={cn(
              "h-full w-full overflow-hidden",
              isPanning ? "cursor-grabbing" : "cursor-grab",
            )}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              className="flex h-full w-full items-center justify-center [&_svg]:max-h-none [&_svg]:max-w-none"
              style={{
                transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                transformOrigin: "center center",
                transition: isPanning ? "none" : "transform 150ms ease",
              }}
              dangerouslySetInnerHTML={{ __html: svgHtml }}
            />
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Lazy-loaded Mermaid diagram component.
 * Only loads mermaid.js when a diagram block is first encountered.
 */
export function MermaidDiagram(props: MermaidDiagramProps) {
  return (
    <Suspense
      fallback={
        <div className="my-4 flex h-32 items-center justify-center rounded-lg border border-white/5 bg-white/5">
          <div className="flex items-center gap-2 text-white/30">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-primary" />
            <span className="text-xs">Loading diagram renderer...</span>
          </div>
        </div>
      }
    >
      <MermaidDiagramInner {...props} />
    </Suspense>
  );
}

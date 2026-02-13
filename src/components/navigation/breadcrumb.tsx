import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getCompanyDotColor,
  getCompanyDisplayName,
} from "@/lib/companies";

interface BreadcrumbSegment {
  /** Display label */
  label: string;
  /** Absolute path this segment represents (directory or file) */
  path: string | null;
  /** Company name if this is a company-scoped segment */
  company: string | null;
}

interface BreadcrumbProps {
  /** Absolute path to the currently selected file */
  selectedFile: string | null;
  /** Absolute path to the HQ root folder */
  hqFolderPath: string | null;
  /** Callback when a breadcrumb segment is clicked (navigates to dir/INDEX.md) */
  onNavigateToPath?: (absolutePath: string) => void;
  className?: string;
}

/**
 * Breadcrumb navigation with glass styling.
 *
 * Shows the current file path relative to the HQ root with clickable segments.
 * Detects company-scoped paths and shows company color dot + name.
 * Truncates gracefully on narrow windows.
 */
export function Breadcrumb({
  selectedFile,
  hqFolderPath,
  onNavigateToPath,
  className,
}: BreadcrumbProps) {
  const segments = useMemo<BreadcrumbSegment[]>(() => {
    if (!selectedFile || !hqFolderPath) return [];

    // Get the path relative to HQ root
    const hqPrefix = hqFolderPath.endsWith("/")
      ? hqFolderPath
      : hqFolderPath + "/";

    if (!selectedFile.startsWith(hqPrefix)) {
      // File is outside HQ — just show the last few segments
      const parts = selectedFile.split("/");
      return parts.slice(-3).map((label, i, arr) => ({
        label,
        path: i < arr.length - 1 ? null : null,
        company: null,
      }));
    }

    const relativePath = selectedFile.slice(hqPrefix.length);
    const parts = relativePath.split("/");

    // Detect company scope: companies/{name}/knowledge/...
    let detectedCompany: string | null = null;
    if (parts[0] === "companies" && parts.length >= 3) {
      detectedCompany = parts[1];
    }

    // Build breadcrumb segments with absolute paths
    const result: BreadcrumbSegment[] = [];

    // Add "HQ" root segment
    result.push({
      label: "HQ",
      path: hqFolderPath,
      company: null,
    });

    // Build path segments from the relative path
    let currentPath = hqFolderPath;
    for (let i = 0; i < parts.length; i++) {
      currentPath = currentPath + "/" + parts[i];
      const isLast = i === parts.length - 1;

      // Determine company for this segment
      let segmentCompany: string | null = null;
      let segmentLabel = parts[i];
      if (i === 1 && parts[0] === "companies" && detectedCompany) {
        segmentCompany = detectedCompany;
        // Use the company display name instead of raw directory name
        segmentLabel = getCompanyDisplayName(detectedCompany);
      }

      result.push({
        label: segmentLabel,
        path: isLast ? null : currentPath,
        company: segmentCompany,
      });
    }

    return result;
  }, [selectedFile, hqFolderPath]);

  // Empty state — no file selected
  if (segments.length === 0) {
    return (
      <div className={cn("inline-flex items-center gap-1.5", className)}>
        <div
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md",
            "bg-white/5 px-2.5 py-1 backdrop-blur-sm",
            "text-xs text-white/40",
          )}
        >
          <span className="text-white/60">HQ</span>
          <ChevronRight className="h-3 w-3 text-white/20" />
          <span className="text-foreground/80">Welcome</span>
        </div>
      </div>
    );
  }

  const handleSegmentClick = (path: string | null) => {
    if (!path || !onNavigateToPath) return;
    onNavigateToPath(path);
  };

  return (
    <div className={cn("min-w-0", className)}>
      <div
        className={cn(
          "inline-flex max-w-full items-center gap-0.5 overflow-hidden rounded-md",
          "bg-white/5 px-2.5 py-1 backdrop-blur-sm",
          "text-xs",
        )}
      >
        {segments.map((segment, i) => {
          const isLast = i === segments.length - 1;
          const isClickable = segment.path !== null && onNavigateToPath;
          const companyColor = segment.company
            ? getCompanyDotColor(segment.company)
            : null;

          return (
            <span key={i} className="flex min-w-0 items-center gap-0.5">
              {/* Chevron separator (skip for first segment) */}
              {i > 0 && (
                <ChevronRight className="mx-0.5 h-3 w-3 shrink-0 text-white/20" />
              )}

              {/* Company color dot */}
              {companyColor && (
                <span
                  className={cn(
                    "mr-1 inline-block h-2 w-2 shrink-0 rounded-full",
                    companyColor,
                  )}
                  title={segment.company || undefined}
                />
              )}

              {/* Segment label */}
              {isClickable ? (
                <button
                  onClick={() => handleSegmentClick(segment.path)}
                  className={cn(
                    "truncate text-white/60 transition-colors duration-150",
                    "hover:text-white/90",
                    "focus-visible:outline-none focus-visible:text-primary",
                  )}
                  title={segment.label}
                >
                  {segment.label}
                </button>
              ) : (
                <span
                  className={cn(
                    "truncate",
                    isLast ? "text-foreground/80" : "text-white/60",
                  )}
                  title={segment.label}
                >
                  {segment.label}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * INDEX.md Parser
 *
 * Parses INDEX.md files (which contain markdown tables) into structured data
 * for rendering as card-based landing pages.
 *
 * INDEX.md format:
 * ```markdown
 * # Directory Name
 *
 * > Auto-generated. Updated: 2026-02-13
 *
 * | Name | Description |
 * |------|-------------|
 * | `item/` | 1-line description |
 * ```
 *
 * Variants may include Status or Progress columns.
 */

/** A single entry parsed from an INDEX.md table row */
export interface IndexEntry {
  /** Item name (directory or file name) */
  name: string;
  /** Description from the table */
  description: string;
  /** Whether this entry is a directory (name ends with /) */
  isDirectory: boolean;
  /** Status value if present (e.g., "active", "completed", "archived") */
  status: string | null;
  /** Progress value if present (e.g., "5/11 45%") */
  progress: string | null;
  /** Date value if present */
  date: string | null;
}

/** Parsed result from an INDEX.md file */
export interface ParsedIndex {
  /** Title from the first # heading */
  title: string;
  /** Subtitle/description line if present (blockquote) */
  subtitle: string | null;
  /** Parsed table entries */
  entries: IndexEntry[];
  /** Column names detected from the table header */
  columns: string[];
}

/**
 * Parse an INDEX.md file content into structured data.
 *
 * Handles standard INDEX.md format with Name + Description columns,
 * and variant formats with Status, Progress, or Date columns.
 */
export function parseIndexMd(content: string): ParsedIndex | null {
  const lines = content.split("\n");

  // Extract title from first # heading
  let title = "";
  for (const line of lines) {
    const headingMatch = line.match(/^#\s+(.+)$/);
    if (headingMatch) {
      title = headingMatch[1].trim();
      break;
    }
  }

  if (!title) return null;

  // Extract subtitle from blockquote
  let subtitle: string | null = null;
  for (const line of lines) {
    const quoteMatch = line.match(/^>\s+(.+)$/);
    if (quoteMatch) {
      subtitle = quoteMatch[1].trim();
      break;
    }
  }

  // Find the table header row
  let headerRowIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("|") && line.includes("Name")) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    // No table found — return parsed title/subtitle with empty entries
    return { title, subtitle, entries: [], columns: [] };
  }

  // Parse header columns
  const headerCells = parseTableRow(lines[headerRowIndex]);
  const columns = headerCells.map((c) => c.trim().toLowerCase());

  // Find column indices
  const nameIdx = columns.findIndex(
    (c) => c === "name" || c === "file" || c === "item",
  );
  const descIdx = columns.findIndex(
    (c) => c === "description" || c === "desc" || c === "about",
  );
  const statusIdx = columns.findIndex((c) => c === "status");
  const progressIdx = columns.findIndex(
    (c) => c === "progress" || c === "completion",
  );
  const dateIdx = columns.findIndex((c) => c === "date" || c === "updated");

  if (nameIdx === -1) {
    return { title, subtitle, entries: [], columns: headerCells };
  }

  // Skip the separator row (|------|------|)
  const dataStartIndex = headerRowIndex + 2;

  // Parse data rows
  const entries: IndexEntry[] = [];
  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("|")) break; // End of table

    const cells = parseTableRow(line);
    if (cells.length === 0) continue;

    const rawName = cells[nameIdx] || "";
    // Strip backticks and trailing slash for display, but detect directory
    const cleanName = rawName.replace(/`/g, "").trim();
    const isDirectory = cleanName.endsWith("/");
    const name = isDirectory ? cleanName.slice(0, -1) : cleanName;

    if (!name) continue;

    const description = descIdx >= 0 ? (cells[descIdx] || "").trim() : "";
    const status = statusIdx >= 0 ? (cells[statusIdx] || "").trim() || null : null;
    const progress =
      progressIdx >= 0 ? (cells[progressIdx] || "").trim() || null : null;
    const date = dateIdx >= 0 ? (cells[dateIdx] || "").trim() || null : null;

    entries.push({
      name,
      description,
      isDirectory,
      status,
      progress,
      date,
    });
  }

  return {
    title,
    subtitle,
    entries,
    columns: headerCells.map((c) => c.trim()),
  };
}

/**
 * Parse a markdown table row into cells.
 * Handles the leading and trailing pipe characters.
 */
function parseTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return [];

  // Remove leading and trailing pipes, split by pipe
  const inner = trimmed.slice(1, trimmed.endsWith("|") ? -1 : undefined);
  return inner.split("|").map((cell) => cell.trim());
}

/**
 * Determine the badge color for a status value.
 * Maps common status strings to Tailwind color classes.
 */
export function getStatusColor(status: string): {
  bg: string;
  text: string;
  dot: string;
} {
  const normalized = status.toLowerCase().trim();

  switch (normalized) {
    case "active":
    case "in progress":
    case "in-progress":
      return {
        bg: "bg-emerald-500/15",
        text: "text-emerald-400",
        dot: "bg-emerald-400",
      };
    case "complete":
    case "completed":
    case "done":
      return {
        bg: "bg-blue-500/15",
        text: "text-blue-400",
        dot: "bg-blue-400",
      };
    case "archived":
    case "deprecated":
    case "inactive":
      return {
        bg: "bg-white/5",
        text: "text-white/40",
        dot: "bg-white/30",
      };
    case "planned":
    case "pending":
    case "todo":
      return {
        bg: "bg-amber-500/15",
        text: "text-amber-400",
        dot: "bg-amber-400",
      };
    case "blocked":
    case "error":
    case "failed":
      return {
        bg: "bg-red-500/15",
        text: "text-red-400",
        dot: "bg-red-400",
      };
    default:
      return {
        bg: "bg-white/5",
        text: "text-white/50",
        dot: "bg-white/40",
      };
  }
}

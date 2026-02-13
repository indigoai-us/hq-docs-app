/**
 * HQ Directory Scanner
 *
 * Scans the connected HQ folder for .md files within configurable scopes,
 * resolves symlinks transparently, and returns a typed FileTreeNode[] tree.
 *
 * Uses a Rust-side Tauri command (scan_hq_directory) for performance.
 * Frontend manages scope config, caching, and re-scan triggers.
 */

import { invoke } from "@tauri-apps/api/core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single node in the file tree (file or directory). */
export interface FileTreeNode {
  /** Display name (filename or directory name) */
  name: string;
  /** Absolute filesystem path */
  path: string;
  /** Whether this node is a directory */
  isDirectory: boolean;
  /** Title extracted from the first `# ` heading in .md files */
  title: string | null;
  /** Child nodes (populated for directories) */
  children: FileTreeNode[];
  /** Depth in the tree (0 = root scope directory) */
  depth: number;
  /** Number of .md files in this subtree (for directories) */
  fileCount: number;
  /** Last modified timestamp (seconds since epoch) */
  modified: number | null;
}

/** A scope definition for which directories to scan. */
export interface ScanScope {
  /** Unique ID for this scope (e.g., "knowledge-public") */
  id: string;
  /** Human-readable label (e.g., "Knowledge (Public)") */
  label: string;
  /** Relative path pattern from HQ root. `*` matches any single directory level. */
  pattern: string;
  /** Whether this scope is enabled by default */
  defaultEnabled: boolean;
  /** Display tier grouping */
  tier: "hq" | "company" | "tools";
}

// ---------------------------------------------------------------------------
// Default Scopes
// ---------------------------------------------------------------------------

/**
 * Configurable scope system matching hq-knowledge-site.
 * Each scope maps a relative path pattern from the HQ root.
 */
export const DEFAULT_SCOPES: ScanScope[] = [
  {
    id: "knowledge-public",
    label: "Knowledge (Public)",
    pattern: "knowledge/public",
    defaultEnabled: true,
    tier: "hq",
  },
  {
    id: "knowledge-private",
    label: "Knowledge (Private)",
    pattern: "knowledge/private",
    defaultEnabled: true,
    tier: "hq",
  },
  {
    id: "company-knowledge",
    label: "Company Knowledge",
    pattern: "companies/*/knowledge",
    defaultEnabled: true,
    tier: "company",
  },
  {
    id: "workers",
    label: "Workers",
    pattern: "workers",
    defaultEnabled: false,
    tier: "tools",
  },
  {
    id: "commands",
    label: "Commands",
    pattern: ".claude/commands",
    defaultEnabled: false,
    tier: "tools",
  },
  {
    id: "projects",
    label: "Projects",
    pattern: "projects",
    defaultEnabled: false,
    tier: "tools",
  },
];

// ---------------------------------------------------------------------------
// Scanner
// ---------------------------------------------------------------------------

/**
 * Scan the HQ directory for .md files within the given scopes.
 *
 * Invokes the Rust-side `scan_hq_directory` Tauri command for performance
 * (handles symlink resolution, title extraction, and recursive traversal).
 *
 * @param hqPath - Absolute path to the HQ root folder
 * @param enabledScopeIds - IDs of scopes to include (from DEFAULT_SCOPES)
 * @returns Array of FileTreeNode roots, one per matched scope directory
 */
export async function scanHqDirectory(
  hqPath: string,
  enabledScopeIds: string[],
): Promise<FileTreeNode[]> {
  // Resolve scope IDs to patterns
  const patterns = enabledScopeIds
    .map((id) => DEFAULT_SCOPES.find((s) => s.id === id))
    .filter((s): s is ScanScope => s !== undefined)
    .map((s) => s.pattern);

  if (patterns.length === 0) {
    return [];
  }

  const results = await invoke<FileTreeNode[]>("scan_hq_directory", {
    hqPath,
    scopes: patterns,
  });

  return results;
}

/**
 * Get the default enabled scope IDs.
 */
export function getDefaultEnabledScopes(): string[] {
  return DEFAULT_SCOPES.filter((s) => s.defaultEnabled).map((s) => s.id);
}

/**
 * Count total .md files across all tree roots.
 */
export function countTotalFiles(roots: FileTreeNode[]): number {
  return roots.reduce((sum, root) => sum + root.fileCount, 0);
}

/**
 * Find a node in the tree by its absolute path.
 */
export function findNodeByPath(
  roots: FileTreeNode[],
  targetPath: string,
): FileTreeNode | null {
  for (const root of roots) {
    const found = findInNode(root, targetPath);
    if (found) return found;
  }
  return null;
}

function findInNode(
  node: FileTreeNode,
  targetPath: string,
): FileTreeNode | null {
  if (node.path === targetPath) return node;
  for (const child of node.children) {
    const found = findInNode(child, targetPath);
    if (found) return found;
  }
  return null;
}

/** A group of tree roots organized by tier. */
export interface TierGroup {
  /** Tier identifier */
  tier: "hq" | "company" | "tools";
  /** Human-readable label for the tier */
  label: string;
  /** Tree roots belonging to this tier */
  roots: FileTreeNode[];
}

/** Labels for each tier */
const TIER_LABELS: Record<string, string> = {
  hq: "HQ Knowledge",
  company: "Company Knowledge",
  tools: "Tools",
};

/**
 * Group tree roots by their scope tier.
 *
 * Maps each tree root back to a scope by matching its path against
 * scope patterns, then groups roots under their respective tier.
 * Only returns tiers that have at least one root.
 */
export function groupTreeByTier(
  roots: FileTreeNode[],
  enabledScopeIds: string[],
  hqPath: string,
): TierGroup[] {
  const enabledScopes = enabledScopeIds
    .map((id) => DEFAULT_SCOPES.find((s) => s.id === id))
    .filter((s): s is ScanScope => s !== undefined);

  const tierMap: Record<string, FileTreeNode[]> = {};
  const tierOrder: ("hq" | "company" | "tools")[] = ["hq", "company", "tools"];

  for (const root of roots) {
    // Match root path to scope by checking if root.path ends with the scope pattern
    let matchedTier: string = "hq"; // default fallback
    for (const scope of enabledScopes) {
      // The root path should end with one of the scope patterns
      // Handle wildcard patterns like "companies/*/knowledge"
      const patternParts = scope.pattern.split("/");
      const rootRelative = root.path.replace(hqPath + "/", "");
      const rootParts = rootRelative.split("/");

      if (patternParts.length === rootParts.length) {
        let matches = true;
        for (let i = 0; i < patternParts.length; i++) {
          if (patternParts[i] !== "*" && patternParts[i] !== rootParts[i]) {
            matches = false;
            break;
          }
        }
        if (matches) {
          matchedTier = scope.tier;
          break;
        }
      }
      // Also match if root is a child of the pattern (e.g. "companies/liverecover/knowledge")
      if (scope.pattern.includes("*")) {
        const regex = new RegExp(
          "^" + scope.pattern.replace("*", "[^/]+") + "$",
        );
        if (regex.test(rootRelative)) {
          matchedTier = scope.tier;
          break;
        }
      }
    }

    if (!tierMap[matchedTier]) {
      tierMap[matchedTier] = [];
    }
    tierMap[matchedTier].push(root);
  }

  return tierOrder
    .filter((tier) => tierMap[tier] && tierMap[tier].length > 0)
    .map((tier) => ({
      tier,
      label: TIER_LABELS[tier] || tier,
      roots: tierMap[tier],
    }));
}

/**
 * Flatten the tree into a list of all file nodes (non-directory).
 */
export function flattenFiles(roots: FileTreeNode[]): FileTreeNode[] {
  const files: FileTreeNode[] = [];
  function collect(node: FileTreeNode) {
    if (!node.isDirectory) {
      files.push(node);
    }
    for (const child of node.children) {
      collect(child);
    }
  }
  for (const root of roots) {
    collect(root);
  }
  return files;
}

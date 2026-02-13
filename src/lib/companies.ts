/**
 * Company configuration for visual isolation.
 *
 * Defines accent colors and display labels for each known company.
 * Companies are auto-detected from `companies/` subdirectories in the HQ folder.
 * Unknown companies get a fallback neutral color.
 */

/** A company's visual configuration */
export interface CompanyConfig {
  /** Unique identifier (directory name under companies/) */
  id: string;
  /** Human-readable display name */
  displayName: string;
  /** Tailwind accent color class for the dot indicator */
  dotColor: string;
  /** Hex color value for non-Tailwind contexts */
  hexColor: string;
}

/**
 * Known company configurations.
 * The key is the directory name under `companies/`.
 */
export const COMPANY_CONFIGS: Record<string, CompanyConfig> = {
  liverecover: {
    id: "liverecover",
    displayName: "LiveRecover",
    dotColor: "bg-emerald-400",
    hexColor: "#34D399",
  },
  abacus: {
    id: "abacus",
    displayName: "Abacus",
    dotColor: "bg-blue-400",
    hexColor: "#60A5FA",
  },
  indigo: {
    id: "indigo",
    displayName: "Indigo",
    dotColor: "bg-primary",
    hexColor: "#4F46E5",
  },
  personal: {
    id: "personal",
    displayName: "Personal",
    dotColor: "bg-amber-400",
    hexColor: "#FBBF24",
  },
  "golden-thread": {
    id: "golden-thread",
    displayName: "Golden Thread",
    dotColor: "bg-rose-400",
    hexColor: "#FB7185",
  },
};

/** Fallback config for unknown companies */
const FALLBACK_CONFIG: Omit<CompanyConfig, "id" | "displayName"> = {
  dotColor: "bg-white/40",
  hexColor: "#9CA3AF",
};

/**
 * Get the visual config for a company by its directory name.
 * Returns a full CompanyConfig even for unknown companies (using fallback colors).
 */
export function getCompanyConfig(companyId: string): CompanyConfig {
  const known = COMPANY_CONFIGS[companyId];
  if (known) return known;

  // Create config for unknown company with capitalized display name
  return {
    id: companyId,
    displayName: companyId.charAt(0).toUpperCase() + companyId.slice(1),
    ...FALLBACK_CONFIG,
  };
}

/**
 * Extract the company name from a file path relative to the HQ root.
 * Returns null if the path is not under `companies/{name}/knowledge/`.
 *
 * @param relativePath - Path relative to the HQ root (e.g., "companies/abacus/knowledge/docs/foo.md")
 */
export function extractCompanyFromPath(relativePath: string): string | null {
  const parts = relativePath.split("/");
  if (parts[0] === "companies" && parts.length >= 3) {
    return parts[1];
  }
  return null;
}

/**
 * Get the dot color class for a company by its directory name.
 */
export function getCompanyDotColor(companyId: string): string {
  return COMPANY_CONFIGS[companyId]?.dotColor ?? FALLBACK_CONFIG.dotColor;
}

/**
 * Get the display name for a company by its directory name.
 */
export function getCompanyDisplayName(companyId: string): string {
  return (
    COMPANY_CONFIGS[companyId]?.displayName ??
    companyId.charAt(0).toUpperCase() + companyId.slice(1)
  );
}

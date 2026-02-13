import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Truncate a filesystem path for display.
 * Replaces /Users/{name}/ with ~/ on macOS.
 * Truncates long Windows paths to drive + last 2 segments.
 */
export function truncatePath(path: string): string {
  // Replace home directory prefix with ~
  const homePrefixMatch = path.match(/^\/Users\/[^/]+\//);
  if (homePrefixMatch) {
    return "~/" + path.slice(homePrefixMatch[0].length);
  }

  // Windows: keep drive letter + last segments
  const winMatch = path.match(/^[A-Z]:\\/);
  if (winMatch && path.length > 40) {
    const segments = path.split("\\");
    return segments[0] + "\\...\\" + segments.slice(-2).join("\\");
  }

  return path;
}

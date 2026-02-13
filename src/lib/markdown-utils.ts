export interface TocItem {
  id: string;
  text: string;
  level: number;
}

/**
 * Extract TOC items from markdown content.
 * Parses heading lines (# through ######) from the raw markdown string.
 */
export function extractTocItems(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  const lines = markdown.split("\n");

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].replace(/[*_`~[\]]/g, "").trim();
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

      items.push({ id, text, level });
    }
  }

  return items;
}

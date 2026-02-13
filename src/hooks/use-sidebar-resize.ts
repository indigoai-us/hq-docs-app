/**
 * Hook for managing sidebar resize via drag handle.
 *
 * Features:
 * - Drag handle to resize sidebar width (200-400px range)
 * - Width persisted to Tauri store
 * - Double-click drag handle to reset to default width
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { load } from "@tauri-apps/plugin-store";

/** Store key for sidebar width */
const SIDEBAR_WIDTH_KEY = "sidebar-width";
/** Default sidebar width in pixels */
const DEFAULT_WIDTH = 260;
/** Minimum sidebar width in pixels */
const MIN_WIDTH = 200;
/** Maximum sidebar width in pixels */
const MAX_WIDTH = 400;

interface UseSidebarResizeReturn {
  /** Current sidebar width in pixels */
  width: number;
  /** Whether the user is currently dragging */
  isDragging: boolean;
  /** Mouse event handlers for the drag handle */
  handleMouseDown: (e: React.MouseEvent) => void;
  /** Reset width to default */
  resetWidth: () => void;
}

/**
 * Manage sidebar resize state with persistence.
 */
export function useSidebarResize(): UseSidebarResizeReturn {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_WIDTH);

  // Load saved width from store on mount
  useEffect(() => {
    let cancelled = false;

    async function loadWidth() {
      try {
        const store = await load(SIDEBAR_WIDTH_KEY);
        const saved = await store.get<number>("width");
        if (saved && !cancelled) {
          setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, saved)));
        }
      } catch {
        // Cache miss is fine — use default
      }
    }

    loadWidth();
    return () => {
      cancelled = true;
    };
  }, []);

  // Save width to store (debounced via the mouseup handler)
  const saveWidth = useCallback(async (w: number) => {
    try {
      const store = await load(SIDEBAR_WIDTH_KEY);
      await store.set("width", w);
      await store.save();
    } catch {
      // Persist failure is non-critical
    }
  }, []);

  // Mouse handlers for drag resize
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startXRef.current = e.clientX;
      startWidthRef.current = width;
    },
    [width],
  );

  // Global mouse move/up while dragging
  useEffect(() => {
    if (!isDragging) return;

    function handleMouseMove(e: MouseEvent) {
      const delta = e.clientX - startXRef.current;
      const newWidth = Math.max(
        MIN_WIDTH,
        Math.min(MAX_WIDTH, startWidthRef.current + delta),
      );
      setWidth(newWidth);
    }

    function handleMouseUpWithWidth(e: MouseEvent) {
      const delta = e.clientX - startXRef.current;
      const finalWidth = Math.max(
        MIN_WIDTH,
        Math.min(MAX_WIDTH, startWidthRef.current + delta),
      );
      setIsDragging(false);
      saveWidth(finalWidth);
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUpWithWidth);

    // Prevent text selection while dragging
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUpWithWidth);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isDragging, saveWidth]);

  // Reset to default width
  const resetWidth = useCallback(() => {
    setWidth(DEFAULT_WIDTH);
    saveWidth(DEFAULT_WIDTH);
  }, [saveWidth]);

  return {
    width,
    isDragging,
    handleMouseDown,
    resetWidth,
  };
}

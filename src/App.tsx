import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { ContentArea } from "@/components/layout/content-area";
import { WelcomeScreen } from "@/components/onboarding/welcome-screen";
import { SettingsModal } from "@/components/settings/settings-modal";
import { AboutDialog } from "@/components/about/about-dialog";
import { CommandPalette } from "@/components/search/command-palette";
import { useAppConfig } from "@/hooks/use-app-config";
import { useFileTree } from "@/hooks/use-file-tree";
import { useFileWatcher } from "@/hooks/use-file-watcher";
import { useSidebarResize } from "@/hooks/use-sidebar-resize";
import { groupTreeByTier } from "@/lib/scanner";

function App() {
  const {
    config,
    loading,
    error,
    pickFolder,
    setHqFolder,
    disconnectFolder,
    isConnected,
    pathError,
  } = useAppConfig();

  const {
    tree,
    loading: treeLoading,
    rescanning,
    error: treeError,
    rescan,
    enabledScopes,
    setEnabledScopes,
    totalFiles,
  } = useFileTree(isConnected ? config.hqFolderPath : null);

  const {
    width: sidebarWidth,
    isDragging: sidebarDragging,
    handleMouseDown: handleSidebarResizeMouseDown,
    resetWidth: resetSidebarWidth,
  } = useSidebarResize();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [contentRefreshKey, setContentRefreshKey] = useState(0);

  // Track selectedFile in a ref so watcher callbacks can read it without
  // causing the watcher hook to re-subscribe on every file selection
  const selectedFileRef = useRef(selectedFile);
  selectedFileRef.current = selectedFile;

  // File watcher: auto-refresh content and tree on disk changes
  const handleFileChange = useCallback((changedPath: string) => {
    // If the changed file is the one currently being viewed, refresh it
    if (selectedFileRef.current && selectedFileRef.current === changedPath) {
      setContentRefreshKey((k) => k + 1);
    }
  }, []);

  const handleTreeChange = useCallback(() => {
    rescan();
  }, [rescan]);

  const { watching } = useFileWatcher({
    hqPath: isConnected ? config.hqFolderPath : null,
    enabledScopes,
    onFileChange: handleFileChange,
    onTreeChange: handleTreeChange,
  });

  // Compute tier groups from tree roots
  const tierGroups = useMemo(() => {
    if (!config.hqFolderPath || tree.length === 0) return [];
    return groupTreeByTier(tree, enabledScopes, config.hqFolderPath);
  }, [tree, enabledScopes, config.hqFolderPath]);

  // Keyboard shortcuts: Cmd+K (search), Cmd+, (settings), Cmd+B (sidebar toggle), Escape (close modals)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.metaKey && e.key === ",") {
        e.preventDefault();
        setSettingsOpen((prev) => !prev);
      }
      if (e.metaKey && e.key === "b") {
        e.preventDefault();
        setSidebarVisible((prev) => !prev);
      }
      // Escape to close search, settings, or about
      if (e.key === "Escape") {
        if (searchOpen) {
          // Let the command palette handle its own Escape logic
          return;
        } else if (aboutOpen) {
          e.preventDefault();
          setAboutOpen(false);
        } else if (settingsOpen) {
          e.preventDefault();
          setSettingsOpen(false);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settingsOpen, aboutOpen, searchOpen]);

  // Listen for Tauri menu events (About, Preferences)
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function setupMenuListener() {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const unlistenFn = await listen<string>("menu-item-click", (event) => {
          const menuId = event.payload;
          if (menuId === "about") {
            setAboutOpen(true);
          } else if (menuId === "preferences") {
            setSettingsOpen(true);
          }
        });
        unlisten = unlistenFn;
      } catch {
        // Not in Tauri environment (e.g., web dev server)
      }
    }

    setupMenuListener();
    return () => {
      unlisten?.();
    };
  }, []);

  const handleOpenSearch = useCallback(() => {
    setSearchOpen(true);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setSearchOpen(false);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const handleCloseAbout = useCallback(() => {
    setAboutOpen(false);
  }, []);

  // Handle selecting a file from sidebar
  const handleSelectFile = useCallback((filePath: string) => {
    setSelectedFile(filePath);
  }, []);

  // Handle in-app navigation from relative .md links in rendered content
  const handleNavigate = useCallback(
    (relativePath: string) => {
      if (!selectedFile) return;
      // Resolve relative path against current file's directory
      const parts = selectedFile.split("/");
      parts.pop(); // Remove current filename
      const baseParts = parts;

      // Handle relative path segments
      const relParts = relativePath.split("/");
      for (const part of relParts) {
        if (part === "..") {
          baseParts.pop();
        } else if (part !== ".") {
          baseParts.push(part);
        }
      }

      // Strip any #anchor from the path
      const fullPath = baseParts.join("/").split("#")[0];
      setSelectedFile(fullPath);
    },
    [selectedFile],
  );

  // Handle breadcrumb navigation (absolute path — navigates to INDEX.md in directory)
  const handleNavigateToPath = useCallback(
    (absolutePath: string) => {
      // If the path has a file extension, navigate directly to it
      const lastSegment = absolutePath.split("/").pop() || "";
      if (lastSegment.includes(".")) {
        setSelectedFile(absolutePath);
        return;
      }
      // Otherwise treat as directory — try INDEX.md first, then just set the path
      const indexPath = absolutePath + "/INDEX.md";
      setSelectedFile(indexPath);
    },
    [],
  );

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <span className="text-xs text-white/30">Loading...</span>
        </div>
      </div>
    );
  }

  // Show welcome screen when no HQ folder is connected
  // Also show if saved path became invalid (pathError + no working connection)
  const showWelcome = !isConnected;

  if (showWelcome) {
    return (
      <>
        <WelcomeScreen
          onPickFolder={pickFolder}
          onSelectRecent={setHqFolder}
          recentFolders={config.recentFolders}
          error={error}
          pathError={pathError}
        />
        <SettingsModal
          isOpen={settingsOpen}
          onClose={handleCloseSettings}
          config={config}
          onPickFolder={pickFolder}
          onSelectRecent={setHqFolder}
          onDisconnect={disconnectFolder}
          isConnected={isConnected}
          pathError={pathError}
          enabledScopes={enabledScopes}
          onSetEnabledScopes={setEnabledScopes}
          onRescan={rescan}
        />
        <AboutDialog isOpen={aboutOpen} onClose={handleCloseAbout} />
      </>
    );
  }

  // Main app view with sidebar and content
  return (
    <>
      <div className="flex h-screen w-screen overflow-hidden">
        {sidebarVisible && (
          <Sidebar
            hqFolderPath={config.hqFolderPath}
            onOpenSettings={handleOpenSettings}
            onOpenSearch={handleOpenSearch}
            onSelectFile={handleSelectFile}
            selectedFile={selectedFile}
            tierGroups={tierGroups}
            tree={tree}
            treeLoading={treeLoading}
            rescanning={rescanning}
            treeError={treeError}
            totalFiles={totalFiles}
            width={sidebarWidth}
            isDragging={sidebarDragging}
            onResizeMouseDown={handleSidebarResizeMouseDown}
            onResizeReset={resetSidebarWidth}
            watching={watching}
          />
        )}
        <ContentArea
          selectedFile={selectedFile}
          hqFolderPath={config.hqFolderPath}
          onNavigate={handleNavigate}
          onNavigateToPath={handleNavigateToPath}
          refreshKey={contentRefreshKey}
        />
      </div>
      <SettingsModal
        isOpen={settingsOpen}
        onClose={handleCloseSettings}
        config={config}
        onPickFolder={pickFolder}
        onSelectRecent={setHqFolder}
        onDisconnect={disconnectFolder}
        isConnected={isConnected}
        pathError={pathError}
        enabledScopes={enabledScopes}
        onSetEnabledScopes={setEnabledScopes}
        onRescan={rescan}
      />
      <AboutDialog isOpen={aboutOpen} onClose={handleCloseAbout} />
      <CommandPalette
        isOpen={searchOpen}
        onClose={handleCloseSearch}
        onSelectFile={handleSelectFile}
        hqFolderPath={config.hqFolderPath}
      />
    </>
  );
}

export default App;

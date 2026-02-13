import { useState } from "react";
import {
  X,
  FolderOpen,
  Clock,
  CheckCircle2,
  AlertCircle,
  Unlink,
  RefreshCw,
} from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { cn, truncatePath } from "@/lib/utils";
import { APP_NAME, APP_VERSION } from "@/lib/constants";
import type { AppConfig } from "@/lib/config";
import { DEFAULT_SCOPES } from "@/lib/scanner";

interface SettingsModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Close the modal */
  onClose: () => void;
  /** Current app config */
  config: AppConfig;
  /** Open native folder picker to change path */
  onPickFolder: () => Promise<boolean>;
  /** Connect to a recent folder */
  onSelectRecent: (path: string) => Promise<boolean>;
  /** Disconnect the current folder */
  onDisconnect: () => Promise<void>;
  /** Whether the current folder is valid */
  isConnected: boolean;
  /** Path validation error */
  pathError: string | null;
  /** Currently enabled scope IDs */
  enabledScopes: string[];
  /** Update which scopes are enabled */
  onSetEnabledScopes: (scopeIds: string[]) => Promise<void>;
  /** Trigger a manual rescan */
  onRescan: () => Promise<void>;
}

/**
 * Settings modal for managing HQ folder connection and scan scopes.
 * Glass-styled overlay with folder picker, recent folders, and scope toggles.
 */
export function SettingsModal({
  isOpen,
  onClose,
  config,
  onPickFolder,
  onSelectRecent,
  onDisconnect,
  isConnected,
  pathError,
  enabledScopes,
  onSetEnabledScopes,
  onRescan,
}: SettingsModalProps) {
  const [isChanging, setIsChanging] = useState(false);

  if (!isOpen) return null;

  const handlePickFolder = async () => {
    setIsChanging(true);
    try {
      await onPickFolder();
    } finally {
      setIsChanging(false);
    }
  };

  const handleSelectRecent = async (path: string) => {
    setIsChanging(true);
    try {
      const success = await onSelectRecent(path);
      if (success) {
        onClose();
      }
    } finally {
      setIsChanging(false);
    }
  };

  const handleDisconnect = async () => {
    await onDisconnect();
  };

  const handleToggleScope = async (scopeId: string) => {
    const isEnabled = enabledScopes.includes(scopeId);
    const updated = isEnabled
      ? enabledScopes.filter((id) => id !== scopeId)
      : [...enabledScopes, scopeId];
    await onSetEnabledScopes(updated);
  };

  const handleRescan = async () => {
    setIsChanging(true);
    try {
      await onRescan();
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <GlassPanel
          variant="overlay"
          className="w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">Settings</h2>
            <button
              onClick={onClose}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md",
                "text-white/40 transition-colors duration-150",
                "hover:bg-white/10 hover:text-white/70",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-5">
            {/* Current connection */}
            <div>
              <label className="mb-2 block text-xs font-medium text-white/50">
                HQ Folder
              </label>

              {config.hqFolderPath ? (
                <div className="space-y-2">
                  <div
                    className={cn(
                      "flex items-start gap-2 rounded-lg border px-3 py-2.5",
                      isConnected
                        ? "border-white/5 bg-white/5"
                        : "border-destructive/20 bg-destructive/5",
                    )}
                  >
                    {isConnected ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/70" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-white/70">
                        {config.hqFolderPath}
                      </p>
                      {pathError && (
                        <p className="mt-1 text-xs text-destructive/80">
                          {pathError}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={handlePickFolder}
                      disabled={isChanging}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2",
                        "text-xs font-medium",
                        "bg-white/5 text-white/60",
                        "transition-colors duration-150",
                        "hover:bg-white/10 hover:text-white/80",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                      )}
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      Change folder
                    </button>
                    <button
                      onClick={handleDisconnect}
                      disabled={isChanging}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-lg px-3 py-2",
                        "text-xs font-medium",
                        "bg-white/5 text-white/40",
                        "transition-colors duration-150",
                        "hover:bg-destructive/10 hover:text-destructive/80",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                      )}
                    >
                      <Unlink className="h-3.5 w-3.5" />
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handlePickFolder}
                  disabled={isChanging}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3",
                    "text-xs font-medium",
                    "bg-primary/15 text-primary",
                    "border border-primary/20",
                    "transition-all duration-150",
                    "hover:bg-primary/25 hover:border-primary/30",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                >
                  <FolderOpen className="h-4 w-4" />
                  Connect HQ folder
                </button>
              )}
            </div>

            {/* Scan Scopes */}
            {isConnected && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <label className="text-xs font-medium text-white/50">
                    Scan Scopes
                  </label>
                  <button
                    onClick={handleRescan}
                    disabled={isChanging}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2 py-1",
                      "text-[10px] font-medium text-white/40",
                      "transition-colors duration-150",
                      "hover:bg-white/5 hover:text-white/60",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Rescan
                  </button>
                </div>
                <div className="space-y-1.5">
                  {DEFAULT_SCOPES.map((scope) => (
                    <ScopeToggle
                      key={scope.id}
                      scope={scope}
                      enabled={enabledScopes.includes(scope.id)}
                      onToggle={() => handleToggleScope(scope.id)}
                    />
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-white/20">
                  Toggle which directories are scanned for .md files
                </p>
              </div>
            )}

            {/* Recent folders */}
            {config.recentFolders.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-white/30" />
                  <label className="text-xs font-medium text-white/50">
                    Recent folders
                  </label>
                </div>
                <div className="space-y-1">
                  {config.recentFolders.map((folder) => {
                    const isCurrent = folder === config.hqFolderPath;
                    return (
                      <button
                        key={folder}
                        onClick={() => !isCurrent && handleSelectRecent(folder)}
                        disabled={isCurrent || isChanging}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left",
                          "text-xs",
                          "transition-colors duration-150",
                          isCurrent
                            ? "bg-primary/10 text-primary/70 cursor-default"
                            : "text-white/50 hover:bg-white/5 hover:text-white/70",
                          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                          "disabled:cursor-not-allowed",
                        )}
                      >
                        <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{truncatePath(folder)}</span>
                        {isCurrent && (
                          <span className="ml-auto shrink-0 text-[10px] text-primary/50">
                            Current
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/5 px-5 py-3">
            <p className="text-center text-[10px] text-white/20">
              {APP_NAME} v{APP_VERSION}
            </p>
          </div>
        </GlassPanel>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// ScopeToggle
// ---------------------------------------------------------------------------

interface ScopeToggleProps {
  scope: { id: string; label: string; pattern: string; tier: string };
  enabled: boolean;
  onToggle: () => void;
}

function ScopeToggle({ scope, enabled, onToggle }: ScopeToggleProps) {
  const tierColors: Record<string, string> = {
    hq: "bg-primary/20 text-primary/80",
    company: "bg-emerald-500/20 text-emerald-400/80",
    tools: "bg-amber-500/20 text-amber-400/80",
  };

  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left",
        "transition-colors duration-150",
        enabled
          ? "bg-white/5 text-white/70"
          : "text-white/30 hover:bg-white/[0.02] hover:text-white/40",
      )}
    >
      {/* Toggle indicator */}
      <div
        className={cn(
          "flex h-4 w-7 shrink-0 items-center rounded-full px-0.5 transition-colors duration-150",
          enabled ? "bg-primary/30" : "bg-white/10",
        )}
      >
        <div
          className={cn(
            "h-3 w-3 rounded-full transition-all duration-150",
            enabled ? "translate-x-3 bg-primary" : "translate-x-0 bg-white/30",
          )}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium">{scope.label}</p>
        <p className="text-[10px] text-white/20">{scope.pattern}</p>
      </div>

      <span
        className={cn(
          "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase",
          tierColors[scope.tier] || "bg-white/10 text-white/40",
        )}
      >
        {scope.tier}
      </span>
    </button>
  );
}

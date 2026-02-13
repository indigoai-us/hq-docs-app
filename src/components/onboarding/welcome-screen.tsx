import { FolderOpen, Clock, AlertCircle } from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { IndigoLogo } from "@/components/ui/indigo-logo";
import { Titlebar } from "@/components/layout/titlebar";
import { cn, truncatePath } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

interface WelcomeScreenProps {
  /** Open native folder picker */
  onPickFolder: () => Promise<boolean>;
  /** Connect to a specific recent folder */
  onSelectRecent: (path: string) => Promise<boolean>;
  /** Recent folder paths for quick switching */
  recentFolders: string[];
  /** Error message to display */
  error: string | null;
  /** Path validation error */
  pathError: string | null;
}

/**
 * First-launch welcome screen with Indigo branding.
 * Prompts user to connect their HQ folder via native folder picker.
 * Shows recent folders for quick reconnection.
 */
export function WelcomeScreen({
  onPickFolder,
  onSelectRecent,
  recentFolders,
  error,
  pathError,
}: WelcomeScreenProps) {
  const displayError = error || pathError;

  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-hidden">
      <GlassPanel
        variant="content"
        className="flex h-full w-full flex-col items-center"
      >
        {/* Titlebar drag region */}
        <Titlebar />

        {/* Centered content */}
        <div className="flex flex-1 flex-col items-center justify-center px-8 pb-16">
          {/* Logo and branding */}
          <div className="mb-8 flex flex-col items-center gap-4">
            <IndigoLogo size={64} />
            <div className="text-center">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                {APP_NAME}
              </h1>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-white/50">
                Turn any HQ folder into a polished, browsable documentation
                site with macOS-native glass UI.
              </p>
            </div>
          </div>

          {/* Connect HQ prompt */}
          <div className="w-full max-w-sm space-y-4">
            <button
              onClick={onPickFolder}
              className={cn(
                "group flex w-full items-center justify-center gap-3",
                "rounded-xl px-6 py-4",
                "bg-primary/15 text-primary",
                "border border-primary/20",
                "transition-all duration-150",
                "hover:bg-primary/25 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <FolderOpen className="h-5 w-5 transition-transform duration-150 group-hover:scale-110" />
              <span className="text-sm font-medium">Connect your HQ</span>
            </button>

            <p className="text-center text-xs text-white/30">
              Select a folder containing your markdown documentation
            </p>

            {/* Error display */}
            {displayError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-xs leading-relaxed text-destructive/90">
                  {displayError}
                </p>
              </div>
            )}

            {/* Recent folders */}
            {recentFolders.length > 0 && (
              <div className="pt-4">
                <div className="mb-2 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-white/30" />
                  <span className="text-xs font-medium text-white/30">
                    Recent folders
                  </span>
                </div>
                <div className="space-y-1">
                  {recentFolders.map((folder) => (
                    <button
                      key={folder}
                      onClick={() => onSelectRecent(folder)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left",
                        "text-xs text-white/50",
                        "transition-colors duration-150",
                        "hover:bg-white/5 hover:text-white/70",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                      )}
                    >
                      <FolderOpen className="h-3.5 w-3.5 shrink-0 text-white/30" />
                      <span className="truncate">{truncatePath(folder)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 pb-6 text-center">
          <span className="text-xs text-white/20">
            Built by Indigo
          </span>
        </div>
      </GlassPanel>
    </div>
  );
}


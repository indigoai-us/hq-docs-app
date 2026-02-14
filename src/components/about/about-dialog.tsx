import { X, ExternalLink } from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { IndigoLogo } from "@/components/ui/indigo-logo";
import { cn } from "@/lib/utils";
import { APP_VERSION, APP_NAME, GITHUB_URL } from "@/lib/constants";

interface AboutDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Close the dialog */
  onClose: () => void;
}

/**
 * About dialog showing app branding, version, credits, and GitHub link.
 * Glass-styled modal matching the app's native aesthetic.
 */
export function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
  if (!isOpen) return null;

  const handleOpenGitHub = async () => {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(GITHUB_URL);
    } catch {
      // Fallback for non-Tauri environment (dev)
      window.open(GITHUB_URL, "_blank");
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <GlassPanel
          variant="overlay"
          className="w-full max-w-xs"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <div className="flex justify-end px-4 pt-4">
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

          {/* Content */}
          <div className="flex flex-col items-center px-6 pb-6">
            {/* Logo */}
            <IndigoLogo size={64} />

            {/* App name */}
            <h2 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
              {APP_NAME}
            </h2>

            {/* Version */}
            <p className="mt-1 text-xs text-white/40">
              Version {APP_VERSION}
            </p>

            {/* Description */}
            <p className="mt-3 max-w-[240px] text-center text-xs leading-relaxed text-white/50">
              Turn any HQ folder into a polished, browsable documentation site
              with native glass UI.
            </p>

            {/* GitHub link */}
            <button
              onClick={handleOpenGitHub}
              className={cn(
                "mt-4 flex items-center gap-2 rounded-lg px-4 py-2",
                "text-xs font-medium text-white/50",
                "bg-white/5 transition-colors duration-150",
                "hover:bg-white/10 hover:text-white/70",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
              )}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View on GitHub
            </button>

            {/* Credit */}
            <p className="mt-5 text-[10px] text-white/20">
              Built by Indigo
            </p>
          </div>
        </GlassPanel>
      </div>
    </>
  );
}

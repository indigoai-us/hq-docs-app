import { cn } from "@/lib/utils";

interface IndigoLogoProps {
  /** Size in pixels (width and height) */
  size?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Indigo Docs branded logo icon.
 * Book/docs motif rendered as an SVG with Indigo purple (#4F46E5) accent.
 * Used in welcome screen, sidebar header, about dialog, and empty states.
 */
export function IndigoLogo({ size = 32, className }: IndigoLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-label="Indigo Docs"
    >
      {/* Background rounded square */}
      <rect
        width="64"
        height="64"
        rx="14"
        fill="url(#indigo-gradient)"
      />
      {/* Open book shape */}
      <path
        d="M16 18C16 16.8954 16.8954 16 18 16H29C30.1046 16 31 16.8954 31 18V46C31 47.1046 30.1046 48 29 48H18C16.8954 48 16 47.1046 16 46V18Z"
        fill="rgba(255,255,255,0.95)"
      />
      <path
        d="M33 18C33 16.8954 33.8954 16 35 16H46C47.1046 16 48 16.8954 48 18V46C48 47.1046 47.1046 48 46 48H35C33.8954 48 33 47.1046 33 46V18Z"
        fill="rgba(255,255,255,0.85)"
      />
      {/* Book spine */}
      <rect x="30" y="14" width="4" height="36" rx="2" fill="rgba(255,255,255,0.3)" />
      {/* Text lines - left page */}
      <rect x="19" y="22" width="9" height="1.5" rx="0.75" fill="#4F46E5" opacity="0.6" />
      <rect x="19" y="26" width="7" height="1.5" rx="0.75" fill="#4F46E5" opacity="0.4" />
      <rect x="19" y="30" width="8" height="1.5" rx="0.75" fill="#4F46E5" opacity="0.3" />
      <rect x="19" y="34" width="6" height="1.5" rx="0.75" fill="#4F46E5" opacity="0.25" />
      {/* Text lines - right page */}
      <rect x="36" y="22" width="9" height="1.5" rx="0.75" fill="#4F46E5" opacity="0.5" />
      <rect x="36" y="26" width="7" height="1.5" rx="0.75" fill="#4F46E5" opacity="0.35" />
      <rect x="36" y="30" width="8" height="1.5" rx="0.75" fill="#4F46E5" opacity="0.25" />
      {/* Gradient definition */}
      <defs>
        <linearGradient id="indigo-gradient" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4F46E5" />
          <stop offset="1" stopColor="#3730A3" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * Indigo Docs icon without background (for use on colored backgrounds).
 * Shows just the book motif in white.
 */
export function IndigoLogoMark({ size = 32, className }: IndigoLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-label="Indigo Docs"
    >
      {/* Open book shape */}
      <path
        d="M4 6C4 4.89543 4.89543 4 6 4H21C22.1046 4 23 4.89543 23 6V42C23 43.1046 22.1046 44 21 44H6C4.89543 44 4 43.1046 4 42V6Z"
        fill="currentColor"
        opacity="0.95"
      />
      <path
        d="M25 6C25 4.89543 25.8954 4 27 4H42C43.1046 4 44 4.89543 44 6V42C44 43.1046 43.1046 44 42 44H27C25.8954 44 25 43.1046 25 42V6Z"
        fill="currentColor"
        opacity="0.8"
      />
      {/* Book spine */}
      <rect x="22" y="2" width="4" height="44" rx="2" fill="currentColor" opacity="0.3" />
      {/* Text lines - left */}
      <rect x="8" y="12" width="11" height="2" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="8" y="18" width="8" height="2" rx="1" fill="currentColor" opacity="0.2" />
      <rect x="8" y="24" width="10" height="2" rx="1" fill="currentColor" opacity="0.15" />
      {/* Text lines - right */}
      <rect x="29" y="12" width="11" height="2" rx="1" fill="currentColor" opacity="0.25" />
      <rect x="29" y="18" width="8" height="2" rx="1" fill="currentColor" opacity="0.18" />
    </svg>
  );
}

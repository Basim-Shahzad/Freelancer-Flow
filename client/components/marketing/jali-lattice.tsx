import { cn } from "@/lib/utils";

/** Subtle jali (lattice) pattern for the Pakistan hero. Stroke follows currentColor (set via a token class). */
export function JaliLattice({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn(
        "pointer-events-none absolute inset-0 size-full text-border [mask-image:linear-gradient(to_right,transparent_35%,var(--foreground))] rtl:[mask-image:linear-gradient(to_left,transparent_35%,var(--foreground))]",
        className,
      )}
    >
      <defs>
        <pattern id="jali" width="64" height="64" patternUnits="userSpaceOnUse">
          <path d="M32 4l9 19 19 9-19 9-9 19-9-19-19-9 19-9z M0 0l9 9 M64 0l-9 9 M0 64l9-9 M64 64l-9-9" fill="none" stroke="currentColor" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#jali)" />
    </svg>
  );
}

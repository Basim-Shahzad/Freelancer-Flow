import type { CSSProperties } from "react";
import { clientHue } from "@/lib/client-hue";

/** Small identity dot in the client's stable hue. Decorative: the client name always sits next to it. */
export function ClientDot({ clientId, clientIds, className }: { clientId: string; clientIds: readonly string[]; className?: string }) {
  return <span aria-hidden="true" style={{ "--hue": clientHue(clientId, clientIds) } as CSSProperties} className={`inline-block size-2.5 shrink-0 rounded-full bg-[var(--hue)] ${className ?? ""}`} />;
}

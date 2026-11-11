import { StateBlock } from "@/components/domain/state-block";
import { classifyPortalError } from "@/lib/api/mappers/portal";
import { Skeleton } from "@/components/ui/skeleton";

export function PortalSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-8">
      <div className="flex flex-col gap-3"><Skeleton className="h-3 w-20" /><Skeleton className="h-10 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
      <Skeleton className="h-16 w-full" />
      <div className="flex flex-col">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-6 border-b border-border py-5"><div className="flex flex-col gap-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-28" /></div><Skeleton className="h-4 w-20" /></div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

type What = "project" | "invoice" | "milestone";

/** Unknown, replaced or revoked link. Locked-style, no way into the owner's app. */
export function LinkInactive({ what }: { what: What }) {
  return (
    <StateBlock
      kind="locked"
      title={`This ${what} link is no longer active`}
      body="The freelancer turned off this link or replaced it. Ask them for the latest one."
    />
  );
}

/** Every failed portal read maps to one of these. Never offers a way into the owner's app. */
export function PortalErrorState({ error, what, onRetry }: { error: unknown; what: What; onRetry?: () => void }) {
  const { kind, message } = classifyPortalError(error);
  if (kind === "offline") {
    return <StateBlock kind="offline" title="You’re offline" body={`Reconnect to open this ${what}.`} cta={onRetry ? { label: "Try again", onClick: onRetry } : undefined} />;
  }
  if (kind === "expired") {
    return <StateBlock kind="locked" title="This link has expired or isn’t valid" body="Ask the freelancer to send you a fresh link. Links can also be switched off by the sender." />;
  }
  if (kind === "notfound") return <LinkInactive what={what} />;
  if (kind === "ratelimited") {
    return <StateBlock kind="error" title="Too many requests" body="Please wait a moment and try again later." cta={onRetry ? { label: "Try again", onClick: onRetry } : undefined} />;
  }
  return <StateBlock kind="error" title="Couldn’t load this page" body={message} cta={onRetry ? { label: "Try again", onClick: onRetry } : undefined} />;
}

/** The link has no `?token=`. */
export const MissingToken = ({ what }: { what: What }) => <PortalErrorState error={{ isAxiosError: true, response: { status: 401 } }} what={what} />;

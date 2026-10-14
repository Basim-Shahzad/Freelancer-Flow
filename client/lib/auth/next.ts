/**
 * Validates a post-login redirect target. Only same-origin relative paths are allowed:
 * a single leading "/", no protocol-relative ("//host"), backslash or control-character tricks.
 */
export function safeNext(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (/[\\\u0000-\u001f]/.test(value)) return null;
  return value;
}

/** `/login?next=<path>`; the auth pages themselves are never used as a target. */
export function loginUrl(next?: string | null): string {
  const target = safeNext(next);
  if (!target || /^\/(login|signup|forgot-password|onboarding)(\/|\?|$)/.test(target)) return "/login";
  return `/login?next=${encodeURIComponent(target)}`;
}

/** Stable identity colour per client (1..5, plus 6 = neutral). Use as `style={{ "--hue": clientHue(id, clientIds) }}` then `bg-[var(--hue)]`. */
export function clientHueIndex(clientId: string, orderedClientIds: readonly string[]): number {
  const i = orderedClientIds.indexOf(clientId);
  return i < 0 ? 6 : (i % 5) + 1;
}

export function clientHue(clientId: string, orderedClientIds: readonly string[]): string {
  return `var(--hue-${clientHueIndex(clientId, orderedClientIds)})`;
}

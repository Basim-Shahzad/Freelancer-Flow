/** Neutral bar for share links. The issuer's name is shown by each view from the API response. Hidden when printing. */
export function PortalHeader() {
  return (
    <header className="flex items-center gap-3 border-b border-rule px-4 py-3 print:hidden">
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full border border-rule font-serif text-base">P</span>
      <span className="text-sm font-semibold leading-snug">Shared with you</span>
    </header>
  );
}

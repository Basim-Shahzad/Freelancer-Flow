/**
 * Print stylesheet for "Print / PDF" (window.print()). Only the invoice paper prints (stamp included): every
 * element that is neither an ancestor nor a descendant of [data-print-area] is removed from layout, so the
 * right rail (actions, payments, timeline, money) never prints and the paper paginates normally.
 */
const CSS = `@media print {
  @page { margin: 14mm; }
  body * :not(style):not(script):not([data-print-area]):not([data-print-area] *):not(:has([data-print-area])) { display: none !important; }
  [data-print-area] { grid-column: 1 / -1 !important; width: 100% !important; max-width: none !important; border: 0 !important; border-radius: 0 !important; }
  [data-print-area] article { border: 0 !important; padding: 0 !important; }
}`;

export function PrintStyles() {
  return <style data-print-styles>{CSS}</style>;
}

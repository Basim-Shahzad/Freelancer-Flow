/** "Raast · ref RA-4410" */
export function methodSummaryLabel(method: string, reference: string): string {
  return reference ? `${method} · ref ${reference}` : method;
}

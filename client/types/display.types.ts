export const VIEW_CONFIGS = {
   clients: ["table", "cards"],
   projects: ["board", "list", "timeline"],
   invoices: ["table", "summary"],
} as const;

export type ClientView = (typeof VIEW_CONFIGS.clients)[number];
export type ProjectView = (typeof VIEW_CONFIGS.projects)[number];
export type InvoiceView = (typeof VIEW_CONFIGS.invoices)[number];

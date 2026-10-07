import type { Metadata } from "next";

const build = (title: string, description: string, absolute = false): Metadata => ({
  title: absolute ? { absolute: `${title} · Paylancr` } : title,
  description,
  openGraph: { title: `${title} · Paylancr`, description, type: "website" },
});

export const pkMetadata = build(
  "Invoicing for freelancers in Pakistan",
  "Track time, send invoices and share Payoneer, ESFCA, Raast, JazzCash or Easypaisa details your client can copy. Paylancr never touches your money.",
);

export const globalMetadata = build(
  "From finished work to paid, in one clear thread",
  "Track time and milestones, send an invoice in minutes and share payment details your client can copy. Any currency, any bank. Paylancr never touches your money.",
  true,
);

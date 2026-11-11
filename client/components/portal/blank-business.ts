import type { BusinessProfile } from "@/lib/types";

/** Portal visitors have no profile: the invoice's `issuer` block fills in what it has, the rest stays empty. */
export const BLANK_BUSINESS: BusinessProfile = {
  businessName: "", ownerName: "", email: "", taxId: "", address: "",
  defaultCurrency: "USD", defaultTermsDays: 0, invoiceNumberFormat: "", paymentInstructions: "",
};

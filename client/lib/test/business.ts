import type { BusinessProfile } from "@/lib/types";

/** Business view-model fixture for tests. */
export const testBusiness: BusinessProfile = {
  businessName: "Malik Studio", ownerName: "Ayesha Malik", email: "ayesha@maliks.studio",
  taxId: "1234567-8", address: "Gulberg III, Lahore, Pakistan", defaultCurrency: "USD", defaultTermsDays: 14,
  invoiceNumberFormat: "INV-{seq:04d}", paymentInstructions: "", hourlyRate: 4000,
};

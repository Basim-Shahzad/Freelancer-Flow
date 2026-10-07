import { ClientPreview } from "./client-preview";
import { ClientSection, FeaturesSection, FinalCta, Hero, MethodsSection, NeverTouchBand, type MethodItem, type Row, ThreadSection } from "./landing-sections";

const METHODS: MethodItem[] = [
  { name: "Payoneer", body: "International clients and marketplaces. A payment-request link with copy buttons." },
  { name: "ESFCA wire (USD)", body: "Foreign-currency wires, with IBAN, SWIFT and the purpose text your bank expects." },
  { name: "Elevate Pay", body: "For clients paying through Elevate." },
  { name: "Wise, to IBAN", body: "Share your IBAN and SWIFT for Wise transfers." },
  { name: "PKR bank transfer", body: "Local clients, by IBAN." },
  { name: "Raast", body: "Instant local transfers by Raast ID." },
  { name: "JazzCash and Easypaisa", body: "Wallet numbers, copied in one tap." },
  { name: "Anything else", body: "Add your own instructions for any other method." },
];

const FEATURES: Row[] = [
  { title: "Rupees and dollars, side by side", body: "Bill in USD or PKR. Converted figures are always labelled “≈ estimate” with the reference-rate date, because your bank or provider sets the real rate." },
  { title: "Share on WhatsApp", body: "Send the invoice link, or a polite, firm or final reminder, in a WhatsApp message with one tap. Email works too." },
  { title: "Light on data, fine offline", body: "Log time on a weak connection. Entries are kept on your device and sync when you are back online." },
  { title: "Clients need no account", body: "One private link shows the project, the invoice and the payment details. It opens on a phone." },
];

export function LandingPakistan() {
  return (
    <>
      <Hero
        lattice
        eyebrow="Made for freelancers in Pakistan"
        headline="Work in Pakistan. Bill the world. Get paid clearly."
        lede="Paylancr turns finished work into an invoice your client can actually pay: Payoneer, an ESFCA wire, Raast, JazzCash or Easypaisa, in dollars or rupees. You stay in control. We never touch the money."
        specimenNote="Your client sees USD. You see what it is roughly worth in rupees."
        estimateIn="PKR"
      />
      <ThreadSection />
      <MethodsSection
        title="Every way your clients actually pay you."
        body="Pick the methods you accept once. Choose which ones go on each invoice, in the order you prefer, with a live preview of what your client will see."
        items={METHODS}
      />
      <FeaturesSection title="Made for Pakistan first." body="Rupee and dollar billing, the payment methods your clients really use, and the apps you already live in." rows={FEATURES} />
      <ClientSection><ClientPreview estimateIn="PKR" /></ClientSection>
      <NeverTouchBand />
      <FinalCta title="Send your first invoice today." />
    </>
  );
}

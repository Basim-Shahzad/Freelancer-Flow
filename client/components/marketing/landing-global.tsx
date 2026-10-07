import { ClientPreview } from "./client-preview";
import { ClientSection, FeaturesSection, FinalCta, Hero, MethodsSection, NeverTouchBand, type MethodItem, type Row, ThreadSection } from "./landing-sections";

const METHODS: MethodItem[] = [
  { name: "IBAN and SWIFT", body: "Europe, the Gulf and most of the world." },
  { name: "US ACH", body: "Routing number and account number." },
  { name: "UK bank transfer", body: "Sort code and account number." },
  { name: "Payoneer and Wise", body: "Payment-request or account details, ready to copy." },
  { name: "Local wallets and instant rails", body: "Raast, JazzCash, Easypaisa and similar, where your clients use them." },
  { name: "Anything else", body: "Add your own instructions for any other method." },
];

const FEATURES: Row[] = [
  { title: "Any currency", body: "Bill in USD, EUR, GBP, AED, PKR and more. Converted figures are labelled as estimates with the reference-rate date." },
  { title: "Four ways to bill", body: "Hourly, fixed price, monthly retainer or milestones, with optional milestones and progress your client can see." },
  { title: "Reminders that sound like you", body: "Polite, firm or final reminders by email, or as a message you send from WhatsApp." },
  { title: "Works offline", body: "Log time on a plane or a patchy connection. It syncs when you reconnect." },
];

export function LandingGlobal() {
  return (
    <>
      <Hero
        eyebrow="For freelancers everywhere"
        headline="From finished work to paid, in one clear thread."
        lede="Track time and milestones, send an invoice in minutes, and share payment details your client can copy. Any currency, any bank, any country. We never touch the money."
        specimenNote="Your client is billed in your currency. You see a labelled estimate in theirs."
        estimateIn="EUR"
      />
      <ThreadSection />
      <MethodsSection
        title="Whatever your client’s bank uses."
        body="Add your payment methods once, then choose which ones go on each invoice. Every detail has a copy button, and you see a live preview of the client view."
        items={METHODS}
      />
      <FeaturesSection title="Work anywhere. Invoice everywhere." body="No country-specific setup and no locked-in bank. English today, with the layout ready for more languages." rows={FEATURES} />
      <ClientSection><ClientPreview neutral estimateIn="EUR" /></ClientSection>
      <NeverTouchBand />
      <FinalCta title="Send your first invoice in under five minutes." />
    </>
  );
}

import { LandingFooter } from "@/components/marketing/landing-footer";
import { LandingNav } from "@/components/marketing/landing-nav";
import { FxRatesProvider } from "@/lib/hooks/exchange-rates";
import { SPECIMEN_RATES } from "@/components/marketing/specimen-rates";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <FxRatesProvider rates={SPECIMEN_RATES}>
      <div className="@container flex min-h-dvh flex-col bg-background">
        <LandingNav />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">{children}</main>
        <LandingFooter />
      </div>
    </FxRatesProvider>
  );
}

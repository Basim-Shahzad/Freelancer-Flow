import { LandingFooter } from "@/components/marketing/landing-footer";
import { LandingNav } from "@/components/marketing/landing-nav";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="@container flex min-h-dvh flex-col bg-background">
      <LandingNav />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">{children}</main>
      <LandingFooter />
    </div>
  );
}

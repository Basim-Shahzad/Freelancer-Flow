import { LandingPakistan } from "@/components/marketing/landing-pakistan";
import { pkMetadata } from "@/components/marketing/landing-metadata";

// Demo seed dates are relative to today; regenerate hourly.
export const revalidate = 3600;
export const metadata = pkMetadata;

export default function Page() {
  return <LandingPakistan />;
}

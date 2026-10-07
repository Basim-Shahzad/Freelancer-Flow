import { LandingGlobal } from "@/components/marketing/landing-global";
import { globalMetadata } from "@/components/marketing/landing-metadata";

// Demo seed dates are relative to today; regenerate hourly.
export const revalidate = 3600;
export const metadata = globalMetadata;

export default function Page() {
  return <LandingGlobal />;
}

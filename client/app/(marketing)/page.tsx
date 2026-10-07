import { LandingGlobal } from "@/components/marketing/landing-global";
import { globalMetadata, pkMetadata } from "@/components/marketing/landing-metadata";
import { LandingPakistan } from "@/components/marketing/landing-pakistan";

export const revalidate = 3600;

/** "/" renders the landing chosen by NEXT_PUBLIC_LANDING ("pk" | "global", default "global"). */
const isPk = process.env.NEXT_PUBLIC_LANDING === "pk";

export const metadata = isPk ? pkMetadata : globalMetadata;

export default function HomePage() {
  return isPk ? <LandingPakistan /> : <LandingGlobal />;
}

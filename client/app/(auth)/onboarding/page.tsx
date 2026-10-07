import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/auth/onboarding/onboarding-flow";

export const metadata: Metadata = {
  title: "Set up your studio",
  description: "Five short steps: business profile, currency, payment methods, your first client and review.",
  robots: { index: false },
};

export default function Page() {
  return <OnboardingFlow />;
}

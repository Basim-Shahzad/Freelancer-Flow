import type { Metadata } from "next";
import { LogInForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to Paylancr to pick up where you left off.",
};

export default function Page() {
  return <LogInForm />;
}

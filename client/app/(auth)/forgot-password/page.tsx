import type { Metadata } from "next";
import { ForgotForm } from "@/components/auth/forgot-form";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Request a link to reset your Paylancr password.",
};

export default function Page() {
  return <ForgotForm />;
}

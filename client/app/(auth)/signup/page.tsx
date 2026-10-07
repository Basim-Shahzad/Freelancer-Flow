import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create your studio",
  description: "Create a free Paylancr account. Track time, send invoices and share payment details your client can copy.",
};

export default function Page() {
  return <SignUpForm />;
}

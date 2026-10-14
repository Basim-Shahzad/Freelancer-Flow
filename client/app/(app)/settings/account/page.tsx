import type { Metadata } from "next";
import { AccountView } from "@/components/settings/account-view";

export const metadata: Metadata = { title: "Account · Settings" };

export default function AccountSettingsPage() {
  return <AccountView />;
}

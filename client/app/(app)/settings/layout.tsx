import type { Metadata } from "next";
import { Page, PageHeader } from "@/components/ui/section";
import { SettingsNav, SettingsOfflineNotice } from "@/components/settings/settings-nav";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Page>
      <PageHeader eyebrow="Studio" title="Settings" />
      <div className="flex flex-col gap-8">
        <SettingsNav />
        <SettingsOfflineNotice />
        {children}
      </div>
    </Page>
  );
}

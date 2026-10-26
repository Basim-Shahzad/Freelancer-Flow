import { AppShell } from "@/components/shell/app-shell";
import { AuthedFxRatesProvider } from "@/lib/hooks/exchange-rates";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthedFxRatesProvider>
      <AppShell>{children}</AppShell>
    </AuthedFxRatesProvider>
  );
}

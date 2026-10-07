"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/hooks/auth";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAppStore } from "@/lib/store";
import { sleep } from "../form-bits";
import { buildCompletion, initialData, STEP_COUNT, type OnboardingData } from "../onboarding-logic";
import { COUNTRIES, COUNTRY_HINT_KEY, isClientBlank, type CountryCode } from "../schemas";
import { BusinessStep } from "./business-step";
import { ClientStep } from "./client-step";
import { CurrencyStep } from "./currency-step";
import { MethodsStep } from "./methods-step";
import { ReviewStep } from "./review-step";
import { StepRail } from "./step-rail";

const HEADS: [string, string][] = [
  ["Tell us about your business", "This appears at the top of every invoice."],
  ["Currency", "Pick what you usually bill in, and how amounts are shown across Paylancr."],
  ["How do clients pay you?", "Choose every method you accept. Clients see these as instructions on each invoice. They never pay inside Paylancr."],
  ["Add your first client", "You can add more later. The free plan includes two clients."],
  ["Your studio is ready", "Here’s what you set up. All of it can be changed in Settings."],
];

/** Gate: waits for the persisted store, then redirects or mounts the wizard. */
export function OnboardingFlow() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { status, user } = useSession();
  const signedIn = status === "authenticated";
  const onboarded = useAppStore((s) => s.session.onboarded);
  const name = user?.fullName ?? undefined;
  const email = user?.email;
  const finishing = useRef(false);

  useEffect(() => {
    if (!hydrated || finishing.current) return;
    if (status === "unauthenticated") router.replace("/login");
    else if (signedIn && onboarded) router.replace("/dashboard");
  }, [hydrated, status, signedIn, onboarded, router]);

  if (!hydrated || !signedIn || onboarded) return <main id="main" tabIndex={-1} className="outline-none"><PageSkeleton /></main>;
  return <Wizard name={name} email={email ?? ""} finishing={finishing} />;
}

function readCountryHint(): CountryCode | undefined {
  try {
    const v = sessionStorage.getItem(COUNTRY_HINT_KEY);
    return COUNTRIES.find((c) => c.code === v)?.code;
  } catch { return undefined; }
}

function Wizard({ name, email, finishing }: { name?: string; email: string; finishing: React.RefObject<boolean> }) {
  const router = useRouter();
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const upsertMethod = useAppStore((s) => s.upsertMethod);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(() => initialData({ name, country: readCountryHint() }));
  const [busy, setBusy] = useState<"dashboard" | "project" | null>(null);
  const h1 = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  useEffect(() => { if (moved.current) h1.current?.focus(); }, [step]);

  const go = (n: number) => { moved.current = true; setStep(Math.min(STEP_COUNT - 1, Math.max(0, n))); window.scrollTo?.({ top: 0 }); };
  const patch = (p: Partial<OnboardingData>) => setData((d) => ({ ...d, ...p }));

  const finish = async (to: "/dashboard" | "/projects/new") => {
    setBusy(to === "/dashboard" ? "dashboard" : "project");
    await sleep(600);
    const c = buildCompletion(data, email);
    finishing.current = true;
    const [first, ...rest] = c.methods;
    completeOnboarding({
      business: c.business,
      client: c.client,
      method: first ? { kind: first.kind, scheme: first.scheme, label: first.label, fields: first.fields } : undefined,
    });
    for (const m of rest) upsertMethod({ kind: m.kind, scheme: m.scheme, label: m.label, fields: m.fields, enabled: true, isDefault: false });
    toast.success("Your studio is ready.");
    router.push(to);
  };

  const [title, lede] = HEADS[step] ?? HEADS[0]!;
  return (
    <div className="@container">
      <div className="grid min-h-dvh @3xl:grid-cols-[17rem_minmax(0,1fr)]">
        <StepRail step={step} />
        <main id="main" tabIndex={-1} className="flex w-full max-w-3xl flex-col gap-6 px-5 pb-12 pt-7 outline-none @3xl:px-14 @3xl:pb-[4.5rem] @3xl:pt-14">
          <div className="flex flex-col gap-2.5">
            <span className="t-eyebrow">Step {step + 1} of {STEP_COUNT}</span>
            <h1 ref={h1} tabIndex={-1} className="t-h1 outline-none">{title}</h1>
            <p className="max-w-[60ch] text-sm text-muted-foreground [text-wrap:pretty]">{lede}</p>
          </div>

          {step === 0 && <BusinessStep value={data.business} onNext={(business) => { patch({ business }); go(1); }} />}
          {step === 1 && (
            <CurrencyStep
              value={data.currency}
              onChange={(currency) => patch({ currency })}
              onBack={() => go(0)}
              onNext={() => { if (isClientBlank(data.client)) patch({ client: { ...data.client, currency: data.currency.invoiceCurrency } }); go(2); }}
            />
          )}
          {step === 2 && <MethodsStep value={data.methods} onChange={(methods) => patch({ methods })} onBack={() => go(1)} onNext={() => go(3)} onSkip={() => go(3)} />}
          {step === 3 && (
            <ClientStep
              value={data.client}
              onBack={(client) => { patch({ client }); go(2); }}
              onNext={(client) => { patch({ client }); go(4); }}
              onSkip={() => { patch({ client: { contactName: "", company: "", email: "", whatsapp: "", city: "", currency: data.currency.invoiceCurrency } }); go(4); }}
            />
          )}
          {step === 4 && <ReviewStep data={data} busy={busy} onBack={() => go(3)} onFinish={finish} />}
        </main>
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { clientToCreate } from "@/lib/api/mappers/clients";
import { splitBusinessPatch } from "@/lib/api/mappers/profile";
import { useAuthGate, useSession } from "@/lib/hooks/auth";
import { useCreateClient } from "@/lib/hooks/clients";
import { useUpdateProfile } from "@/lib/hooks/profile";
import { useApiToast } from "@/lib/hooks/use-api-toast";
import { useAppStore } from "@/lib/store";
import { sleep } from "../form-bits";
import { buildCompletion, initialData, newProgress, runCompletion, STEP_COUNT, type OnboardingData } from "../onboarding-logic";
import { COUNTRIES, COUNTRY_HINT_KEY, isClientBlank, type CountryCode } from "../schemas";
import { BusinessStep } from "./business-step";
import { ClientStep } from "./client-step";
import { CurrencyStep } from "./currency-step";
import { MethodsStep } from "./methods-step";
import { ReviewStep } from "./review-step";
import { StepRail } from "./step-rail";
import { readNext } from "../use-signed-in-redirect";

const HEADS: [string, string][] = [
  ["Tell us about your business", "This appears at the top of every invoice."],
  ["Currency", "Pick what you usually bill in, and how amounts are shown across Paylancr."],
  ["How do clients pay you?", "Choose every method you accept. Clients see these as instructions on each invoice. They never pay inside Paylancr."],
  ["Add your first client", "You can add more later. The free plan includes two clients."],
  ["Your studio is ready", "Here’s what you set up. All of it can be changed in Settings."],
];

/** Gate: waits for the persisted store, then redirects or mounts the wizard. */
export function OnboardingFlow() {
  const { user } = useSession();
  const name = user?.fullName ?? undefined;
  const email = user?.email;
  const finishing = useRef(false);
  const ready = useAuthGate({ require: "onboarding", suspended: finishing });

  if (!ready) return <main id="main" tabIndex={-1} className="outline-none"><PageSkeleton /></main>;
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
  const createClient = useCreateClient();
  const upsertMethod = useAppStore((s) => s.upsertMethod);
  const updateBusinessLocal = useAppStore((s) => s.updateBusinessLocal);
  const updateProfile = useUpdateProfile();
  const toast = useApiToast();
  /** Progress of `finish`, so a retry after a partial failure resumes instead of repeating finished steps. */
  const done = useRef(newProgress());
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
    // Payment methods still use the mock store until step 5 gives them API hooks.
    finishing.current = true;
    try {
      await runCompletion(c, data.business.country, {
        saveProfile: async (business, country) => {
          const { remote, local } = splitBusinessPatch(business, business.defaultCurrency ?? "USD");
          await updateProfile.mutateAsync({ ...remote, ...(country !== "XX" ? { country } : {}) });
          updateBusinessLocal(local);
        },
        addClient: async (client) => { await createClient.mutateAsync(clientToCreate(client)); },
        addMethod: (m, i) => upsertMethod({ kind: m.kind, scheme: m.scheme, label: m.label, fields: m.fields, enabled: true, isDefault: i === 0 && useAppStore.getState().methods.length === 0 }),
      }, done.current);
    } catch (e) {
      // Once the profile is saved the user counts as onboarded; keep the gate from bouncing them so Review can retry the rest.
      finishing.current = done.current.profile;
      setBusy(null);
      toast.error(e, "We couldn’t save your studio. Check your connection and try again.");
      return;
    }
    toast.success("Your studio is ready.");
    router.push(to === "/dashboard" ? readNext() : to);
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
              onSkip={() => { patch({ client: { name: "", company: "", email: "", whatsapp: "", currency: data.currency.invoiceCurrency } }); go(4); }}
            />
          )}
          {step === 4 && <ReviewStep data={data} busy={busy} onBack={() => go(3)} onFinish={finish} />}
        </main>
      </div>
    </div>
  );
}

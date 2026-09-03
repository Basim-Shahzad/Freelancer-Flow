import React from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const Hero = () => {
   return (
      <section className="relative flex flex-col items-center justify-center overflow-hidden px-6 pt-20 pb-32">
         {/* Background Glow */}
         <div className="absolute top-0 -z-10 h-full w-full bg-background">
            <div className="absolute top-0 right-0 bottom-auto left-auto h-[500px] w-[500px] translate-y-[20%] -translate-x-[30%] rounded-full bg-primary/10 opacity-50 blur-[80px]" />
         </div>

         {/* Badge */}
         <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 animate-fade-in">
            <Sparkles size={14} className="text-primary" />
            <span className="text-xs font-medium text-text-muted">
               Introducing Early Access for Freelancers
            </span>
         </div>

         {/* Heading */}
         <h1 className="mb-6 max-w-4xl text-center text-5xl font-bold tracking-tight text-text md:text-7xl">
            Payments for the <br />
            <span className="text-primary">modern freelancer.</span>
         </h1>

         {/* Subheading */}
         <p className="mb-10 max-w-xl text-center text-lg leading-relaxed text-text-muted md:text-xl">
            Paylancr handles the global invoicing, tax compliance, and instant payouts, so you can focus on the
            craft. No more chasing clients.
         </p>

         {/* CTAs */}
         <div className="flex flex-col items-center gap-4 sm:flex-row">
            <Button size="lg" className="h-12 rounded-full px-8 shadow-lg">
               Join the Waitlist
               <ArrowRight size={18} />
            </Button>

            <Button variant="outline" size="lg" className="h-12 rounded-full px-8">
               Read the Manifesto
            </Button>
         </div>

         {/* UI Mockup Placeholder */}
         <div className="group relative mt-20 w-full max-w-5xl">
            <div className="absolute -inset-1 rounded-2xl bg-primary/40 opacity-20 blur transition duration-1000 group-hover:opacity-30" />
            <div className="relative overflow-hidden rounded-xl border border-border bg-surface/50 shadow-2xl backdrop-blur-sm">
               <div className="flex aspect-16/9 items-center justify-center bg-muted/40">
                  <p className="font-mono text-sm tracking-widest text-text-muted/60">PAYLANCR_DASHBOARD_PREVIEW.PNG</p>
               </div>
            </div>
         </div>
      </section>
   );
};

export default Hero;

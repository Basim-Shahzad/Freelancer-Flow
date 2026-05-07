import React from "react";
import { Button } from "@heroui/react";
import { ArrowRight, Sparkles } from "lucide-react"; 

const Hero = () => {
   return (
      <section className="relative flex flex-col items-center justify-center pt-20 pb-32 overflow-hidden px-6">
         {/* Background Glow - The "SaaS" Look */}
         <div className="absolute top-0 -z-10 h-full w-full bg-white dark:bg-black">
            <div className="absolute bottom-auto left-auto right-0 top-0 h-[500px] w-[500px] -translate-x-[30%] translate-y-[20%] rounded-full bg-primary/10 opacity-50 blur-[80px] dark:bg-primary/20"></div>
         </div>

         {/* Badge */}
         <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/5 mb-8 animate-fade-in">
            <Sparkles size={14} className="text-primary" />
            <span className="text-xs font-medium text-black/60 dark:text-white/60">
               Introducing Early Access for Freelancers
            </span>
         </div>

         {/* Heading */}
         <h1 className="max-w-4xl text-center text-5xl md:text-7xl font-bold tracking-tight text-black dark:text-white mb-6">
            Payments for the <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-neutral-500 via-black to-neutral-500 dark:from-neutral-400 dark:via-white dark:to-neutral-400">
               modern freelancer.
            </span>
         </h1>

         {/* Subheading */}
         <p className="max-w-xl text-center text-lg md:text-xl text-black/60 dark:text-white/60 mb-10 leading-relaxed">
            Paylancer handles the global invoicing, tax compliance, and instant payouts, so you can focus on the craft.
            No more chasing clients.
         </p>

         {/* CTAs */}
         <div className="flex flex-col sm:flex-row gap-4 items-center">
            <Button
               size="lg"
               className="bg-black text-white dark:bg-white dark:text-black font-semibold h-12 px-8 rounded-full shadow-lg hover:opacity-90 transition-all">
               Join the Waitlist
               <ArrowRight size={18} />
            </Button>

            <Button
               variant="secondary"
               size="lg"
               className="border-black/10 dark:border-white/10 text-white dark:text-black font-medium h-12 px-8 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-all">
               Read the Manifesto
            </Button>
         </div>

         {/* UI Mockup Placeholder */}
         <div className="mt-20 relative w-full max-w-5xl group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
            <div className="relative rounded-xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm overflow-hidden shadow-2xl">
               {/* Replace this with your actual Dashboard Screenshot later */}
               <div className="aspect-[16/9] flex items-center justify-center bg-neutral-100 dark:bg-zinc-950/50">
                  <p className="text-sm text-neutral-400 font-mono tracking-widest">PAYLANCER_DASHBOARD_PREVIEW.PNG</p>
               </div>
            </div>
         </div>
      </section>
   );
};

export default Hero;

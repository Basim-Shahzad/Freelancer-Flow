"use client";

import Header from "@/components/Header";
import { useAuthStore } from "@/features/auth/store";
import { useMe } from "@/features/auth/hooks";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
   const user = useAuthStore((s) => s.user);
   const { isLoading } = useMe();

   return (
      <main className="flex h-full flex-col">
         <div className="text-2xl px-8 py-8 select-none text-text">
            <h1>Dashboard</h1>
         </div>

         <section>
            <article className="px-8">
               <p>Earned, not yet in account</p>
               <div className="flex items-end gap-2">
                  <h2 className="text-text-muted text-3xl uppercase font-bold">
                     SAR
                  </h2>
                  <h1 className="text-text text-6xl uppercase font-bold">
                     40,000
                  </h1>
               </div>
            </article>

            <article className="px-8">
               <p>Where the money is standing</p>
               <div className="" >

               </div>
            </article>
         </section>
      </main>
   );
}

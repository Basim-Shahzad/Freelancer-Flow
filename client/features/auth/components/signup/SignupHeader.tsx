"use client";

import Image from "next/image";

interface SignupHeaderProps {
   email?: string;
   showEmail?: boolean;
}

export function SignupHeader({ email, showEmail = false }: SignupHeaderProps) {
   return (
      <div className="flex flex-col items-center gap-4">
         <Image
            src="/logo.png"
            className="invert"
            alt="Paylancer"
            width={50}
            height={50}
         />

         <h1 className="text-3xl font-semibold text-text">
            Track and Earn
         </h1>

         {showEmail && email && (
            <h1 className="w-full text-text-muted text-center text-[14px]">
               {email}
            </h1>
         )}
      </div>
   );
}
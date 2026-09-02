"use client";

import Image from "next/image";

interface LoginHeaderProps {
   email?: string;
   showEmail?: boolean;
}

export function LoginHeader({ email, showEmail = false }: LoginHeaderProps) {
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
            Log in to Paylancer
         </h1>

         {showEmail && email && (
            <p className="w-full text-text-muted text-center text-[14px]">
               {email}
            </p>
         )}
      </div>
   );
}
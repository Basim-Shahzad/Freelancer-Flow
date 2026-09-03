"use client";

import { Button } from "@/components/ui/button";
import { EmailInputForm } from "./EmailInputForm";

interface AuthMethodButtonsProps {
   onEmailClick: () => void;
   onEmailSubmit: (email: string) => void;
   isSigninEmailPress: boolean;
}

export function AuthMethodButtons({
   onEmailClick,
   onEmailSubmit,
   isSigninEmailPress,
}: AuthMethodButtonsProps) {
   return (
      <div className="w-full flex flex-col gap-3">
         <Button className="w-full h-12 rounded-full text-[14px] font-semibold">
            Continue with Google
         </Button>

         <Button variant="outline" onClick={onEmailClick} className="w-full h-12 rounded-full text-[14px] font-medium">
            Continue with email
         </Button>

         {isSigninEmailPress && (
            <div className="w-full flex flex-col gap-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
               <EmailInputForm onSubmit={onEmailSubmit} />
            </div>
         )}
      </div>
   );
}

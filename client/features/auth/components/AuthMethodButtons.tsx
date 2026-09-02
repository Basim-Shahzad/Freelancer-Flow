"use client";

import { Button } from "@heroui/react";
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
         <Button
            size="lg"
            className="w-full text-[14px] bg-primary text-surface font-semibold h-12 rounded-full transition-all hover:opacity-90"
         >
            Continue with Google
         </Button>

         <Button
            onClick={onEmailClick}
            size="lg"
            variant="ghost"
            className="w-full bg-surface/50 text-[14px] text-text font-medium h-12 rounded-full border border-border transition-all hover:bg-surface"
         >
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
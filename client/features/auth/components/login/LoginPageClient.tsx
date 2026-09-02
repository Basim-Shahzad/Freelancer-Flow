"use client";

import { useState } from "react";
import { toast } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useLogin } from "../../hooks";
import { LoginHeader } from "../login/LoginHeader";
import { AuthMethodButtons } from "../AuthMethodButtons";
import { LoginPasswordForm } from "../login/LoginPasswordForm";
import { AuthFooter } from "./LoginFooter";

export function LoginPageClient() {
   const [isSigninEmailPress, setIsSigninEmailPress] = useState(false);
   const [isEmailValid, setIsEmailValid] = useState(false);
   const [email, setEmail] = useState("");

   const router = useRouter();

   const { mutate: login, isPending } = useLogin();

   const handleEmailSubmit = (submittedEmail: string) => {
      setEmail(submittedEmail);
      setIsEmailValid(true);
   };

   const handlePasswordSubmit = (data: { password: string }) => {
      login(
         {
            email,
            password: data.password,
         },
         {
            onSuccess: () => {
               router.push("/dashboard");
            },
            onError: (err) => {
               toast(`Login failed. ${err?.message || "Something went wrong."}`, {
                  variant: "danger",
               });
            },
         }
      );
   };

   if (isEmailValid) {
      return (
         <div className="bg-background h-screen flex items-center flex-col justify-center">
            <div className="flex flex-col items-center w-full max-w-md gap-6 px-4">
               <LoginHeader email={email} showEmail />
               <LoginPasswordForm email={email} onSubmit={handlePasswordSubmit} isPending={isPending} />
               <AuthFooter />
            </div>
         </div>
      );
   }

   return (
      <div className="bg-background h-screen flex items-center flex-col justify-center">
         <div className="flex flex-col items-center w-full max-w-md gap-6 px-4">
            <LoginHeader />
            <AuthMethodButtons
               onEmailClick={() => setIsSigninEmailPress((prev) => !prev)}
               onEmailSubmit={handleEmailSubmit}
               isSigninEmailPress={isSigninEmailPress}
            />
            <AuthFooter />
         </div>
      </div>
   );
}
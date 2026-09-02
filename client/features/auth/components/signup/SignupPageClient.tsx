"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRegister } from "../../hooks";
import { toast } from "@heroui/react";
import { SignupHeader } from "./SignupHeader";
import { AuthMethodButtons } from "../AuthMethodButtons";
import { CredentialsForm } from "../CredentialsForm";
import { AuthFooter } from "../signup/SingupFooter";

export function SignupPageClient() {
   const [isSigninEmailPress, setIsSigninEmailPress] = useState(false);
   const [isEmailValid, setIsEmailValid] = useState(false);
   const [email, setEmail] = useState("");

   const router = useRouter();

   const { mutate: signup, isPending } = useRegister();

   const handleEmailSubmit = (submittedEmail: string) => {
      setEmail(submittedEmail);
      setIsEmailValid(true);
   };

   const handleCredentialsSubmit = (data: { username: string; password: string }) => {
      signup(
         {
            email,
            fullName: data.username,
            password: data.password,
         },
         {
            onSuccess: () => {
               router.push("/dashboard");
            },
            onError: (err: any) => {
               toast(`Sign up failed. ${err?.message || "Something went wrong."}`, {
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
               <SignupHeader email={email} showEmail />
               <CredentialsForm email={email} onSubmit={handleCredentialsSubmit} isPending={isPending} />
               <AuthFooter />
            </div>
         </div>
      );
   }

   return (
      <div className="bg-background h-screen flex items-center flex-col justify-center">
         <div className="flex flex-col items-center w-full max-w-md gap-6 px-4">
            <SignupHeader />
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
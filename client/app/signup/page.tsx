"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/auth/useAuth";
import Image from "next/image";
import { Button, Input, FieldError, TextField, Label, Text, toast } from "@heroui/react";
import Link from "next/link";
import { validateEmail } from "./helpers";

const page = () => {
   const [isSigninEmailPress, setIsSigninEmailPress] = useState<boolean>(false);
   const [email, setEmail] = useState<string>("");
   const [username, setUsername] = useState<string>("");
   const [password, setPassword] = useState<string>("");
   const [isEmailValid, setIsEmailValid] = useState<boolean>(false);

   const router = useRouter();

   const { mutate: signup, isPending } = useMutation({
      mutationFn: useAuth().signup,
      onSuccess() {
         router.push("/dashboard");
      },
      onError(err) {
         toast(`Sign up failed. ${err?.message || "Something went wrong."}`, {
            variant: "danger",
         });
      },
   });

   if (isEmailValid)
      return (
         <div className="bg-black h-screen flex items-center flex-col justify-center ">
            <div className="flex flex-col items-center w-1/5  gap-4">
               <Image src="/logo.png" className="invert" alt="Paylancer" width={50} height={50} />

               <h1 className="text-3xl font-semibold text-white mb-2">Track and Earn</h1>

               <Text className="w-full text-white/75 text-center text-[14px]">{email}</Text>

               <TextField className="w-full" name="username" isRequired>
                  <Label className="text-white/50">Username</Label>
                  <Input
                     placeholder="Enter username"
                     autoFocus
                     value={username}
                     onChange={(e) => setUsername(e.target.value)}
                     className="w-full bg-black border border-white/10 focus:ring-purple-700/50 text-white"
                  />
                  <FieldError>Please enter a valid username</FieldError>
               </TextField>

               <TextField className="w-full" name="password" type="password" isRequired>
                  <Label className="text-white/50">Password</Label>
                  <Input
                     placeholder="••••••••••"
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     className="w-full bg-black border border-white/10 focus:ring-purple-700/50 text-white"
                  />
                  <FieldError>Please enter a valid password</FieldError>
               </TextField>

               <Button
                  size="lg"
                  type="submit"
                  onClick={() =>
                     signup({
                        email: email,
                        fullName: username,
                        password: password,
                     })
                  }
                  isPending={isPending}
                  isDisabled={!username || !password}
                  className="w-full bg-white/10 text-[14px] text-white flex items-center justify-center"
               >
                  Sign up
               </Button>
            </div>
         </div>
      );

   return (
      <div className="bg-black h-screen flex items-center flex-col justify-center ">
         <div className="flex flex-col items-center w-1/5  gap-4">
            <Image src="/logo.png" className="invert" alt="Paylancer" width={50} height={50} />

            <h1 className="text-3xl font-semibold text-white mb-4">Track and Earn</h1>

            <Button
               size="lg"
               className="w-full text-[14px] bg-purple-700/75 text-white flex items-center justify-center"
            >
               Continue with Google
            </Button>

            <Button
               onClick={() => setIsSigninEmailPress((state) => !state)}
               size="lg"
               className="w-full bg-white/10 text-[14px] text-white flex items-center justify-center"
            >
               Continue with email
            </Button>

            {isSigninEmailPress ? (
               <div className="w-full flex flex-col gap-4 mt-4">
                  <TextField className="w-full" name="email" type="email" isRequired aria-label="email">
                     <Input
                        aria-label="email"
                        type="email"
                        name="email"
                        placeholder="Enter your email address..."
                        className="w-full bg-black border border-white/10 focus:ring-purple-700/50 text-white"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoFocus
                     />
                     <FieldError>Please enter a valid email address</FieldError>
                  </TextField>

                  <Button
                     size="lg"
                     type="submit"
                     onClick={() => {
                        if (validateEmail(email)) {
                           setIsEmailValid(true);
                        }
                     }}
                     isDisabled={!email}
                     className="w-full text-[14px] flex items-center justify-center bg-white/10 text-white"
                  >
                     Continue with email
                  </Button>
               </div>
            ) : null}

            <p className="text-sm text-white/70 mt-4 text-center">
               By signing up, you agree to our <b>Terms of Service</b> and <b>Data Processing Agreement</b>.
            </p>

            <p className="text-sm text-white/70">
               Already have an account?{" "}
               <Link href="/login" className="cursor-pointer">
                  Log in
               </Link>
            </p>
         </div>
      </div>
   );
};

export default page;

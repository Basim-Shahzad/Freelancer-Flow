"use client";

import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface CredentialsFormProps {
   email: string;
   onSubmit: (data: { username: string; password: string }) => void;
   isPending: boolean;
}

export function CredentialsForm({
   email,
   onSubmit,
   isPending,
}: CredentialsFormProps) {
   const {
      register,
      handleSubmit,
      formState: { isValid, isSubmitting, errors },
   } = useForm<{ username: string; password: string }>({
      defaultValues: { username: "", password: "" },
      mode: "onChange",
   });

   const pending = isPending || isSubmitting;

   return (
      <form onSubmit={handleSubmit(onSubmit)} className="w-full flex flex-col gap-4">
         <div className="w-full flex flex-col gap-1.5">
            <Label htmlFor="username" className="text-text-muted">
               Username
            </Label>
            <Input
               id="username"
               placeholder="Enter username"
               autoFocus
               aria-invalid={!!errors.username}
               className="w-full h-12 rounded-full px-4"
               {...register("username", { required: "Username is required" })}
            />
            {errors.username && (
               <p className="text-sm text-error px-1" role="alert">
                  {errors.username.message}
               </p>
            )}
         </div>

         <div className="w-full flex flex-col gap-1.5">
            <Label htmlFor="password" className="text-text-muted">
               Password
            </Label>
            <Input
               id="password"
               type="password"
               placeholder="••••••••••"
               aria-invalid={!!errors.password}
               className="w-full h-12 rounded-full px-4"
               {...register("password", {
                  required: "Password is required",
                  minLength: {
                     value: 8,
                     message: "Password must be at least 8 characters",
                  },
                  pattern: {
                     value: /(?=.*[A-Z])(?=.*\d)/,
                     message: "Password must contain at least one uppercase letter and one number",
                  },
               })}
            />
            {errors.password && (
               <p className="text-sm text-error px-1" role="alert">
                  {errors.password.message}
               </p>
            )}
         </div>

         <Button
            type="submit"
            disabled={!isValid || pending}
            className="w-full h-12 rounded-full font-semibold"
         >
            {pending && <Spinner className="text-primary-foreground" />}
            Sign up
         </Button>
      </form>
   );
}

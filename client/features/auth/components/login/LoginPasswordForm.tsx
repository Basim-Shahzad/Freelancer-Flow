"use client";

import { useForm } from "react-hook-form";
import { Button, Input, TextField, Label } from "@heroui/react";

interface LoginPasswordFormProps {
   email: string;
   onSubmit: (data: { password: string }) => void;
   isPending: boolean;
}

export function LoginPasswordForm({ email, onSubmit, isPending }: LoginPasswordFormProps) {
   const { register, handleSubmit, formState: { isValid, isSubmitting, errors } } = useForm<{ password: string }>({
      defaultValues: { password: "" },
      mode: "onChange",
   });

   return (
      <form onSubmit={handleSubmit(onSubmit)} className="w-full flex flex-col gap-4">
         <TextField className="w-full" name="password" type="password" isRequired>
            <Label className="text-text-muted">Password</Label>
            <Input
               placeholder="••••••••••"
               autoFocus
               className="w-full bg-surface border border-border focus:ring-primary/50 text-text"
               {...register("password", {
                  required: "Password is required",
                  minLength: { value: 8, message: "Password must be at least 8 characters" },
                  pattern: {
                     value: /(?=.*[A-Z])(?=.*\d)/,
                     message: "Password must contain at least one uppercase letter and one number",
                  },
               })}
            />
            {errors.password && (
               <p className="text-sm text-error mt-1" role="alert">
                  {errors.password.message}
               </p>
            )}
         </TextField>

         <Button
            type="submit"
            size="lg"
            isPending={isPending || isSubmitting}
            isDisabled={!isValid}
            className="w-full bg-primary text-surface font-semibold h-12 rounded-full transition-all hover:opacity-90 disabled:opacity-50"
         >
            Log in
         </Button>
      </form>
   );
}
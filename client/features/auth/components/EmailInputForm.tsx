"use client";

import { useForm, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { validateEmail } from "../utils";

interface EmailInputFormProps {
   onSubmit: (email: string) => void;
}

export function EmailInputForm({ onSubmit }: EmailInputFormProps) {
   const {
      control,
      handleSubmit,
      formState: { errors },
   } = useForm<{ email: string }>({
      defaultValues: { email: "" },
      mode: "onBlur",
   });

   const handleEmailSubmit = (data: { email: string }) => {
      if (validateEmail(data.email)) {
         onSubmit(data.email);
      }
   };

   return (
      <form onSubmit={handleSubmit(handleEmailSubmit)} className="w-full flex flex-col gap-4">
         <div className="w-full">
            <Controller
               name="email"
               control={control}
               rules={{ validate: (value) => validateEmail(value) || "Please enter a valid email address" }}
               render={({ field }) => (
                  <Input
                     aria-label="email"
                     type="email"
                     placeholder="Enter your email address..."
                     aria-invalid={!!errors.email}
                     className="w-full h-12 rounded-full px-4"
                     {...field}
                     required
                     autoFocus
                  />
               )}
            />
            {errors.email && (
               <p className="text-sm text-error mt-1 px-1" role="alert">
                  {errors.email.message}
               </p>
            )}
         </div>

         <Button type="submit" variant="outline" className="w-full h-12 rounded-full">
            Continue with email
         </Button>
      </form>
   );
}

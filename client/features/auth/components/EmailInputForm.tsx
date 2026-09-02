"use client";

import { useForm, Controller } from "react-hook-form";
import { Button, Input, TextField, Label, FieldError } from "@heroui/react";
import { validateEmail } from "../utils";

interface EmailInputFormProps {
   onSubmit: (email: string) => void;
}

export function EmailInputForm({ onSubmit }: EmailInputFormProps) {
   const { control, handleSubmit, formState: { errors } } = useForm<{ email: string }>({
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
         <TextField className="w-full" name="email" type="email" isRequired aria-label="email">
            <Controller
               name="email"
               control={control}
               render={({ field }) => (
                  <Input
                     aria-label="email"
                     type="email"
                     placeholder="Enter your email address..."
                     className="w-full bg-surface border border-border focus:ring-primary/50 text-text"
                     {...field}
                     required
                     autoFocus
                  />
               )}
            />
            <FieldError>Please enter a valid email address</FieldError>
         </TextField>

         <Button
            type="submit"
            size="lg"
            className="w-full text-[14px] flex items-center justify-center bg-surface/50 text-text font-medium h-12 rounded-full border border-border transition-all hover:bg-surface"
         >
            Continue with email
         </Button>
      </form>
   );
}
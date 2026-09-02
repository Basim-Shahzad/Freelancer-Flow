"use client";

import Link from "next/link";

export function AuthFooter() {
   
   return (
      <div className="w-full flex flex-col items-center gap-2 mt-6">
         <p className="text-sm text-text-muted text-center">
            By signing up, you agree to our <b>Terms of Service</b> and{" "}
            <b>Data Processing Agreement</b>.
         </p>

         <p className="text-sm text-text-muted">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline cursor-pointer">
               Log in
            </Link>
         </p>
      </div>
   );
}
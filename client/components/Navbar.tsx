"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { appName } from "@/config";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const NAV_LINKS = [
   { name: "Product", link: "#" },
   { name: "Pricing", link: "#" },
   { name: "Blog", link: "#" },
   { name: "Contact", link: "#" },
];

const Navbar = () => {
   const router = useRouter();

   return (
      <div className="flex items-center justify-between border-b border-border bg-background px-6 py-3 transition-colors">
         <div className="flex items-center gap-2">
            <Image src="/logo.png" alt={appName} width={32} height={32} />
            <span className="font-mono text-xl font-semibold text-text">{appName}</span>
         </div>

         <div className="flex items-center gap-6">
            <div className="flex gap-8">
               {NAV_LINKS.map((link) => (
                  <Link
                     key={link.name}
                     href={link.link}
                     className="text-sm text-text-muted transition-colors hover:text-text"
                  >
                     {link.name}
                  </Link>
               ))}
            </div>

            <Separator orientation="vertical" className="h-5" />

            <div className="flex gap-2">
               <Button variant="outline" className="rounded-full" onClick={() => router.push("/login")}>
                  Log in
               </Button>

               <Button className="rounded-full" onClick={() => router.push("/signup")}>
                  Sign up
               </Button>
            </div>
         </div>
      </div>
   );
};

export default Navbar;

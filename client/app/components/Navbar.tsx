"use client";

import { useState } from "react";
import Image from "next/image";
import { Button, Separator } from "@heroui/react";

const NAV_LINKS = [
   { name: "Product", link: "#" },
   { name: "Pricing", link: "#" },
   { name: "Blog", link: "#" },
   { name: "Contact", link: "#" },
];

const Navbar = () => {
   const [isDark] = useState(true);

   return (
      <div
         className={`${isDark ? "custom-dark-mode" : ""} border-b border-black/10 py-2 flex items-center justify-between transition-colors`}>
         <div className="flex items-center">
            <Image src="/logo.png" alt="Paylancer" width={50} height={50} className={isDark ? "invert" : ""} />

            <a className="text-xl font-semibold font-mono">Paylancer</a>
         </div>

         <div className="flex items-center mr-8">
            <div className="flex gap-8">
               {NAV_LINKS.map((link) => (
                  <a key={link.name} href={link.link} className="">
                     {link.name}
                  </a>
               ))}
            </div>

            <Separator orientation="vertical" className={`${isDark ? "bg-white/10" : "bg-black/10"} mx-4`} />

            <div className="flex gap-2">
               <Button
                  className={`${isDark ? "text-white bg-black border border-white/10 hover:bg-white/10 " : "text-black bg-white border border-black/10 hover:bg-black/10"}  rounded-full`}>
                  Log in
               </Button>

               <Button className="rounded-full bg-purple-700">Sign Up</Button>
            </div>
         </div>
      </div>
   );
};

export default Navbar;

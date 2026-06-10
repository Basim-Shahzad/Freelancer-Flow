import React, { useEffect, useState } from "react";
import InvoiceCreateHeader from "./InvoiceCreateHeader.js";
import InvoiceCreateForm from "./InvoiceCreateForm.js";
import InvoicePreview from "./InvoicePreview.js";
import MobileHeader from "@/layout/MobileHeader.jsx";

const InvoiceCreate = () => {
   return (
      <div className="flex flex-col lg:flex-row bg-white text-black dark:bg-[#000000] dark:text-white transition-colors duration-300">
         <header>
            <MobileHeader />
         </header>

         <div className="invisible pl-[296px] hidden lg:sticky lg:top-0 lg:bottom-0 lg:left-0 lg:block"></div>

         <main className="min-w-0 flex-1 pt-8 pb-12">
            <div className="flex flex-col gap-8">
               <InvoiceCreateHeader />

               <div className="grid grid-cols-2 px-4 lg:px-8">
                  <InvoiceCreateForm />
                  <InvoicePreview />
               </div>
            </div>
         </main>
      </div>
   );
};

export default InvoiceCreate;

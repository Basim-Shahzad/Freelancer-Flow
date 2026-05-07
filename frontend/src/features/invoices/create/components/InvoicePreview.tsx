import React, { useEffect, useState } from "react";
import InvoiceMetadataCard from "@/features/invoices/create/components/InvoiceMetadataCard.js";
import InvoiceItemsSection from "@/features/invoices/create/components/InvoiceItemsSection.js";

const InvoicePreview = () => {
   return (
      <div className="border border-white/10 px-4 py-4" >
         <InvoiceMetadataCard />
         <InvoiceItemsSection />
      </div>
   );
};

export default InvoicePreview;

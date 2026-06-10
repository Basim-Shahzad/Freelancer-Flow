import React from "react";
import { InvoicesContext } from "@/Contexts/InvoicesContext.js";

export const useInvoices = () => {
   const ctx = React.useContext(InvoicesContext);
   if (!ctx) throw new Error("useInvoices must be used within InvoicesProvider");
   return ctx;
};
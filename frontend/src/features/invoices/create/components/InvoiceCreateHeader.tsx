import { Link } from "react-router-dom";
import { IoIosAdd } from "react-icons/io";
import { Button } from "@heroui/react";

const InvoiceCreateHeader = () => {
   return (
      <div className="flex sm:flex-row sm:justify-between px-4 lg:px-8">
         <h1 className="text-2xl font-semibold  lg:text-display-xs">Create Invoice</h1>
         <div className="flex gap-2">
            <Button color="secondary" isDisabled >Confirm Invoice</Button>
            <Button color="secondary" variant="bordered" isDisabled >
               Discard Draft
            </Button>
         </div>
      </div>
   );
};

export default InvoiceCreateHeader;

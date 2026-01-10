import { Link } from "react-router-dom";
import { Button } from "@heroui/react";
import { useNavigate } from "react-router-dom";
import { IoIosAdd } from "react-icons/io";

const InvoiceHeader = () => {
   const navigate = useNavigate();

   return (
      <div className="flex sm:flex-row sm:justify-between px-4 lg:px-8">
         <h1 className="text-2xl font-semibold  lg:text-display-xs">Invoices</h1>
         <div className="flex gap-4">
            <Button 
               color="secondary" 
               className=""
               startContent={<IoIosAdd className="text-2xl" />}
               onPress={() => navigate('create')}
              >
               Create Invoice
            </Button>
         </div>
      </div>
   );
};

export default InvoiceHeader;

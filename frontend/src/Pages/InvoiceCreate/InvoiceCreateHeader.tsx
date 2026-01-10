import { Link } from "react-router-dom";
import { IoIosAdd } from "react-icons/io";

const InvoiceCreateHeader = () => {
   return (
      <div className="flex sm:flex-row sm:justify-between px-4 lg:px-8">
         <h1 className="text-2xl font-semibold  lg:text-display-xs">Create Invoice</h1>
         {/* <div className="flex gap-4">
            <div className="flex cursor-pointer items-center w-max h-max py-2 px-3 ring ring-white/20 rounded-lg hover:bg-white/10 transition-colors duration-150 gap-1 text-sm">
               <button className="cursor-pointer">Export</button>
            </div>
            <Link
               to={"create"}
               className="flex items-center cursor-pointer bg-[#7F56D9] w-max h-max py-2 px-3 rounded-lg hover:bg-[#9E77ED]/80 transition-colors duration-150 gap- text-sm">
               <IoIosAdd className="text-xl text-white/90" />
               <button className="cursor-pointer">Create Invoice</button>
            </Link>
         </div> */}
      </div>
   );
};

export default InvoiceCreateHeader
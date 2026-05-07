import React, { useState } from "react";
import { useReactTable, getCoreRowModel, flexRender, createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Button } from "@heroui/react";
import { useTimeEntries } from "@/features/timeTracking/hooks.js";

interface InvoiceItem {
   id: string;
   description: string;
   qty: number;
   unitPrice: number;
}

const columnHelper = createColumnHelper<InvoiceItem>();

const InvoiceItemsSection: React.FC = () => {
   const [items, setItems] = useState<InvoiceItem[]>([]);

   // Dummy add function — drops a random pre-made service entry
   const handleAddItem = () => {
      let newEntry = {
         id: "1",
         description: "sd",
         qty: 1,
         unitPrice: 123,
      };
      setItems((prev) => [...prev, newEntry]);
   };

   const handleRemoveItem = (id: string) => {
      setItems((prev) => prev.filter((item) => item.id !== id));
   };

   const total = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);

   const columns: ColumnDef<InvoiceItem, any>[] = [
      columnHelper.accessor("description", {
         header: "Description",
         cell: (info) => <span className="text-white/90 font-medium text-sm">{info.getValue()}</span>,
      }),
      columnHelper.accessor("qty", {
         header: "Qty / Time",
         cell: (info) => <span className="text-white/60 text-sm tabular-nums">{info.getValue()}h</span>,
      }),
      columnHelper.accessor("unitPrice", {
         header: "Unit Price",
         cell: (info) => <span className="text-white/60 text-sm tabular-nums">${info.getValue().toFixed(2)}</span>,
      }),
      columnHelper.display({
         id: "amount",
         header: "Amount ($)",
         cell: ({ row }) => (
            <span className="text-white text-sm font-semibold tabular-nums">
               ${(row.original.qty * row.original.unitPrice).toFixed(2)}
            </span>
         ),
      }),
      columnHelper.display({
         id: "actions",
         header: "",
         cell: ({ row }) => (
            <button
               onClick={() => handleRemoveItem(row.original.id)}
               className="opacity-0 group-hover/row:opacity-100 transition-opacity duration-150 text-white/30 hover:text-red-400 p-1 rounded"
               title="Remove item">
               <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
               </svg>
            </button>
         ),
      }),
   ];

   const table = useReactTable({
      data: items,
      columns,
      getCoreRowModel: getCoreRowModel(),
   });

   return (
      <div className="border border-white/10 rounded-xl mt-4">

         <table className="w-full border-collapse">
            <thead>
               {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b border-white/10">
                     {headerGroup.headers.map((header) => (
                        <th
                           key={header.id}
                           className="px-4 py-2 text-left text-xs font-medium text-white/65 uppercase tracking-widest first:pl-5 last:pr-5 last:w-10">
                           {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                     ))}
                  </tr>
               ))}
            </thead>

            <tbody>
               {table.getRowModel().rows.length === 0 ? (
                  <tr>
                     <td colSpan={columns.length}>
                        <div className="flex flex-col items-center justify-center py-8 cursor-pointer group/empty">
                           <div className="mb-2 text-white/20 group-hover/empty:text-white/35 transition-colors duration-200">
                              <svg
                                 width="38"
                                 height="38"
                                 viewBox="0 0 24 24"
                                 fill="none"
                                 stroke="currentColor"
                                 strokeWidth="1.25"
                                 strokeLinecap="round"
                                 strokeLinejoin="round">
                                 <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                 <polyline points="14 2 14 8 20 8" />
                              </svg>
                           </div>
                           <p className="text-sm text-white/30 group-hover/empty:text-white/50 transition-colors duration-200">
                              Your invoice is empty.
                           </p>
                        </div>
                     </td>
                  </tr>
               ) : (
                  table.getRowModel().rows.map((row) => (
                     <tr
                        key={row.id}
                        className="border-b border-white/[0.06] group/row hover:bg-white/[0.03] transition-colors duration-100">
                        {row.getVisibleCells().map((cell) => (
                           <td key={cell.id} className="px-4 py-3 first:pl-5 last:pr-5 last:text-right">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                           </td>
                        ))}
                     </tr>
                  ))
               )}
            </tbody>

            {items.length > 0 && (
               <tfoot>
                  <tr className="border-t border-white/10 bg-white/2">
                     <td colSpan={3} className="px-5 py-3 text-right text-xs text-white/40 uppercase tracking-widest">
                        Total
                     </td>
                     <td className="px-4 py-3 text-white font-bold text-sm tabular-nums">${total.toFixed(2)}</td>
                     <td className="pr-5" />
                  </tr>
               </tfoot>
            )}
         </table>

         <div className="flex items-center justify-end px-5 py-3 border-t border-white/10">
            <Button
               onPress={handleAddItem}
               color="secondary"
               variant="light"
               // className="flex items-center gap-1.5 text-sm text-purple-400 hover:text-purple-300 active:scale-95 transition-all duration-150 font-medium"
            >
               <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
               </svg>
               Add new item
            </Button>
         </div>
      </div>
   );
};

export default InvoiceItemsSection;

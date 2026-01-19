import React, { useMemo, useState } from "react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import { Checkbox, Spinner } from "@heroui/react";
import { useNavigate } from "react-router-dom";
import { useClients } from "../hooks.js";
import type { Client } from "../types.js";

const ClientsDataTable = () => {
   const navigate = useNavigate();
   const [rowSelection, setRowSelection] = useState({});
   const [pagination, setPagination] = useState({
      pageIndex: 0,
      pageSize: 10,
   });

   const { data: response, isLoading, isError } = useClients(pagination.pageIndex + 1, pagination.pageSize);

   const clients = response?.items ?? [];
   const totalCount = response?.total ?? 0;

   const columns = useMemo(
      () => [
         {
            id: "select",
            header: ({ table }: any) => (
               <Checkbox
                  color="secondary"
                  isSelected={table.getIsAllRowsSelected()}
                  onChange={table.getToggleAllRowsSelectedHandler()}
               />
            ),
            cell: ({ row }: any) => (
               <div onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                     color="secondary"
                     isSelected={row.getIsSelected()}
                     onChange={row.getToggleSelectedHandler()}
                  />
               </div>
            ),
         },
         {
            accessorKey: "name",
            header: "Name",
         },
         {
            accessorKey: "email",
            header: "Email",
         },
         {
            accessorKey: "company",
            header: "Company"
         }
      ],
      [],
   );

   const table = useReactTable({
      data: clients,
      columns,
      pageCount: totalCount > 0 ? Math.ceil(totalCount / pagination.pageSize) : 1,
      state: { rowSelection, pagination },
      onRowSelectionChange: setRowSelection,
      onPaginationChange: setPagination,
      manualPagination: true,
      getCoreRowModel: getCoreRowModel(),
      getRowId: (row) => row.id.toString(),
   });

   return (
      <div className="w-full">
         <div className="flex items-center justify-between px-4 py-4 border border-white/10 rounded-t-2xl bg-[#08090a]">
            <h2 className="text-2xl text-white">Clients</h2>
            <span className="text-xs border border-white/20 px-2 py-1 rounded text-white/60">{totalCount} Total</span>
         </div>

         <div className="overflow-x-auto border-x border-white/10">
            <table className="min-w-full">
               <thead className="bg-[#08090a] border-b border-white/10">
                  {table.getHeaderGroups().map((headerGroup) => (
                     <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                           <th key={header.id} className="text-start px-5 py-3 text-white/70 text-sm font-medium">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                           </th>
                        ))}
                     </tr>
                  ))}
               </thead>
               <tbody className="divide-y divide-white/10">
                  {isLoading ? (
                     <tr>
                        <td colSpan={columns.length} className="py-10 text-center">
                           <Spinner color="secondary" />
                        </td>
                     </tr>
                  ) : isError ? (
                     <tr>
                        <td colSpan={columns.length} className="py-10 text-center text-red-400">
                           Failed to load clients. Please try again.
                        </td>
                     </tr>
                  ) : clients.length === 0 ? (
                     <tr>
                        <td colSpan={columns.length} className="py-10 text-center text-white/50">
                           No clients found.
                        </td>
                     </tr>
                  ) : (
                     table.getRowModel().rows.map((row) => (
                        <tr
                           key={row.id}
                           className="hover:bg-white/5 cursor-pointer transition-colors"
                           onClick={() => navigate(`/clients/${row.original.id}`)}>
                           {row.getVisibleCells().map((cell) => (
                              <td key={cell.id} className="py-3 px-5 text-white/90">
                                 {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                           ))}
                        </tr>
                     ))
                  )}
               </tbody>
            </table>
         </div>

         <div className="flex justify-between items-center px-5 py-3 border border-white/10 rounded-b-2xl bg-[#08090a]">
            <p className="text-white/60 text-sm">
               Page {pagination.pageIndex + 1} of {table.getPageCount()}
            </p>
            <div className="flex gap-2">
               <button
                  className="px-4 py-1 border border-white/20 rounded disabled:opacity-30 text-white"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}>
                  Previous
               </button>
               <button
                  className="px-4 py-1 border border-white/20 rounded disabled:opacity-30 text-white"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}>
                  Next
               </button>
            </div>
         </div>
      </div>
   );
};

export default ClientsDataTable;

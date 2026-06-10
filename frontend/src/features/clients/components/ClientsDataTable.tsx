import React, { useMemo, useState } from "react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import { Checkbox, Spinner } from "@heroui/react";
import { useNavigate } from "react-router-dom";
import { useClients } from "../hooks.js";
import type { ClientInList } from "../types.js";
import EmailCopyCell from "./EmailCopyCell.js";
import type { Row } from "@tanstack/react-table";
import { MdOutlinePhone, MdOutlineEdit, MdDeleteOutline } from "react-icons/md";

const ClientsDataTable = () => {
   const navigate = useNavigate();
   const [rowSelection, setRowSelection] = useState({});
   const [pagination, setPagination] = useState({
      pageIndex: 0,
      pageSize: 10,
   });

   const {
      data: clientsData,
      isLoading: clientsLoading,
      isError: clientsIsError,
      error: clientsError,
   } = useClients(true);

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
            cell: ({ row }: { row: Row<ClientInList> }) => (
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
            header: "Email",
            cell: ({ row }: { row: Row<ClientInList> }) => {
               const email = row.original.email;

               // Return the component only if email exists
               return email ? <EmailCopyCell email={email} /> : <span style={{ color: "#9ca3af" }}>N/A</span>;
            },
         },
         {
            header: "Phone",
            cell: ({ row }: { row: Row<ClientInList> }) => (
               <div className="flex items-center gap-0.5">
                  {row.original.phone ? <MdOutlinePhone className="opacity-50 text-xl" /> : ""}
                  <p className="text-sm">{row.original.phone ? row.original.phone : ""}</p>
               </div>
            ),
         },
         {
            header: "Project(s)",
            cell: ({ row }: { row: Row<ClientInList> }) => {
               const projects = row.original.projects;
               const count = projects.length;

               if (count === 0) {
                  return <span className="text-muted-foreground italic">No Projects</span>;
               }

               if (count === 1) {
                  return <span className="font-medium">{projects[0].name}</span>;
               }

               return (
                  <div className="flex items-center gap-2">
                     <span className="font-medium">{projects[0].name}</span>
                     <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                        +{count - 1} more
                     </span>
                  </div>
               );
            },
         },
         {
            header: "Actions",
            cell: ({ row }: { row: Row<ClientInList> }) => (
               <div className="flex gap-2 w-max">
                  <div
                     onClick={(e) => e.stopPropagation()}
                     className="px-1 py-1 hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-colors duration-150">
                     <MdOutlineEdit className="text-2xl " />
                  </div>
                  <div
                     onClick={(e) => e.stopPropagation()}
                     className="px-1 py-1 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors duration-150">
                     <MdDeleteOutline className="text-2xl " />
                  </div>
               </div>
            ),
         },
      ],
      [],
   );

   const table = useReactTable({
      data: clientsData?.results?.clients ?? [],
      columns,
      pageCount: clientsData!?.count > 0 ? Math.ceil(clientsData!?.count / pagination.pageSize) : 1,
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
            <div className="flex items-center gap-4" >
               <h2 className="text-2xl text-white">Client List</h2>
               <div className="text-xs border flex border-white/20 px-2 py-1 rounded text-white/60">
                  {clientsData?.count} Total
               </div>
            </div>
            <div className="relative flex w-max items-center rounded-lg ring-1 ring-white/20">
               <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  className="absolute left-3 text-[#85888E]"
                  aria-hidden="true">
                  <path d="m21 21-3.5-3.5m2.5-6a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z" />
               </svg>

               <input
                  type="text"
                  placeholder="Search"
                  className="w-full bg-transparent px-3 py-2 pl-10 text-md outline-none"
               />
            </div>
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
                  {clientsLoading ? (
                     <tr>
                        <td colSpan={columns.length} className="py-10 text-center">
                           <Spinner color="secondary" />
                        </td>
                     </tr>
                  ) : clientsIsError ? (
                     <tr>
                        <td colSpan={columns.length} className="py-10 text-center text-red-400">
                           {clientsIsError ? clientsError.message : `Failed to load clients. Please try again.`}
                        </td>
                     </tr>
                  ) : clientsData?.count === 0 ? (
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
                           // onClick={() => navigate(`/clients/${row.original.id}`)}
                        >
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

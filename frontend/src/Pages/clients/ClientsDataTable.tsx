import React, { useEffect, useState } from "react";
import {
   useReactTable,
   getCoreRowModel,
   createColumnHelper,
   flexRender,
   getSortedRowModel,
   getFilteredRowModel,
   getPaginationRowModel,
} from "@tanstack/react-table";
import { type ColumnDef } from "@tanstack/table-core";
import { useFormatters } from "../../hooks/useFormatters.js";
import { Checkbox } from "@heroui/react";
import { useNavigate } from "react-router-dom";
import { useClients } from "../../hooks/useClients.js";

const ClientsDataTable = () => {
   const [pagination, setPagination] = useState({
      pageIndex: 0,
      pageSize: 8,
   });
   const { formatDate, formatDueDate } = useFormatters();
   const [rowSelection, setRowSelection] = useState({});
   const navigate = useNavigate();

   const { clients, clientsError, clientsLoading, clientsTotal } = useClients(
      pagination.pageIndex + 1,
      pagination.pageSize
   );

   type Client = {
      id: number;
      name: string;
      email: string;
   };

   // const {
   //    findProjectId,
   //    createProject,
   //    isCreating,
   //    isDeleting,
   //    isLoading,
   //    projects,
   //    error,
   //    deleteProject,
   //    projectsTotal,
   // } = useProjects(pagination.pageIndex + 1, pagination.pageSize);

   const columns: ColumnDef<Client>[] = [
      {
         id: "select",
         header: ({ table }) => (
            <Checkbox
               color="secondary"
               type="checkbox"
               isSelected={table.getIsAllRowsSelected()}
               onChange={table.getToggleAllRowsSelectedHandler()}
            />
         ),
         cell: ({ row }) => (
            <Checkbox color="secondary" isSelected={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} />
         ),
      },
      {
         accessorKey: "name",
         header: "Name",
         cell: ({ row }) => <div className="">{row.original?.name}</div>,
      },
      {
         accessorKey: "email",
         header: "Email",
         cell: ({ row }) => <div className="">{row.original?.email}</div>,
      },
   ];

   const table = useReactTable({
      columns,
      data: clients ?? [],
      state: {
         rowSelection,
         pagination,
      },
      onRowSelectionChange: setRowSelection,
      onPaginationChange: setPagination,
      enableRowSelection: true,
      getCoreRowModel: getCoreRowModel(),
      manualPagination: true,
      pageCount: Math.ceil(clientsTotal / pagination.pageSize),
   });

   const currentPage : number = pagination.pageIndex + 1;
   const totalPages : number = Math.ceil(clientsTotal / pagination.pageSize);

   return (
      <div className="">
         <div className="TABLE_HEADER gap-2 flex items-center justify-between px-5 py-4 border border-white/10 rounded-t-2xl">
            <div className="flex gap-2 items-center">
               <div className="text-2xl text-white/95 ">All Clients</div>
               <div className="text-xs rounded-md border border-white/4s0 text-white/70 flex h-max w-max px-2 py-1 ">
                  {clientsTotal == 0 ? "No" : clientsTotal} Clients
               </div>
            </div>
            <div>
               <button className="border border-white/30 rounded-md px-3 py-0.5 cursor-pointer hover:opacity-90">
                  Sort by
               </button>
            </div>
         </div>
         <table className="min-w-full border border-white/10">
            {/*  */}
            <thead className="">
               {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="">
                     {headerGroup.headers.map((header) => (
                        <th
                           key={header.id}
                           className="text-start px-5 py-3 bg-[#08090a] text-white/75 text-sm font-normal ">
                           {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                     ))}
                  </tr>
               ))}
            </thead>
            {/*  */}
            <tbody>
               {clientsLoading && (
                  <tr>
                     <td colSpan={columns.length} className="py-5 text-center text-red-600/70 text-9xl">
                        Loading...
                     </td>
                  </tr>
               )}

               {!clientsLoading && clientsError && (
                  <tr>
                     <td colSpan={columns.length} className="py-5 text-center text-red-400">
                        Error: {clientsError.message}
                     </td>
                  </tr>
               )}

               {!clientsLoading && !clientsError && clientsTotal == 0 && (
                  <tr>
                     <td colSpan={columns.length} className="py-5 text-center text-white/70">
                        No projects found
                     </td>
                  </tr>
               )}

               {!clientsLoading &&
                  !clientsError &&
                  table.getRowModel().rows.map((row) => (
                     <tr
                        key={Number(row.original.id)}
                        className={`${
                           row.getIsSelected() ? "bg-[#08090a]" : ""
                        } hover:bg-[#08090a] transition-all duration-150 cursor-pointer`}
                        onClick={() => {
                           const clientId: number = row?.original?.id;
                           navigate(`/clients/${clientId}`);
                        }}>
                        {row.getVisibleCells().map((cell) => (
                           <td key={cell.id} className="py-3 px-5 text-white/90 border-b border-t border-white/10">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                           </td>
                        ))}
                     </tr>
                  ))}
            </tbody>
         </table>
         <div className="TABLE_HEADER flex justify-between items-center px-5 py-3 border-b border-l border-r border-white/10 rounded-b-2xl">
            <div className="text-white/95 ">Page {currentPage} of {totalPages || 1}</div>
            <div className="flex gap-6">
               <button
                  className="border border-white/30 rounded-md px-3 py-0.5 cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage() || clientsLoading}>
                  Previous
               </button>
               <button
                  className="border border-white/30 rounded-md px-3 py-0.5 cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage() || clientsLoading}>
                  Next
               </button>
            </div>
         </div>
      </div>
   );
};
export default ClientsDataTable;

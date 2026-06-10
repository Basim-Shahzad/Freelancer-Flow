import React, { useMemo, useState } from "react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import { Select, SelectItem, Spinner } from "@heroui/react";
import { useNavigate } from "react-router-dom";
import { useInvoices } from "../../hooks.js";
import type { InvoiceInList, InvoiceStatus } from "../../types.js";
import type { Row } from "@tanstack/react-table";

const InvoicesTable = () => {
   const navigate = useNavigate();

   const [pagination, setPagination] = useState({
      pageIndex: 0,
      pageSize: 10,
   });

   const [statusFilter, setStatusFilter] = useState<InvoiceStatus | undefined>(undefined);

   const { data: invoicesData, isLoading, isError, error } = useInvoices(true, statusFilter);

   const invoices = invoicesData?.results?.invoices ?? [];

   const filteredInvoices = useMemo(() => {
      if (!statusFilter) return invoices;
      return invoices.filter((inv) => inv.status === statusFilter);
   }, [invoices, statusFilter]);

   const capitalizeFirstLetter = (str: string): string => {
      if (!str) return str;
      return str.charAt(0).toUpperCase() + str.slice(1);
   };

   const columns = useMemo(
      () => [
         {
            accessorKey: "invoiceNumber",
            header: "Invoice #",
         },
         {
            accessorKey: "clientName",
            header: "Client",
         },
         {
            accessorKey: "projectName",
            header: "Project",
         },
         {
            accessorKey: "issueDate",
            header: "Issue Date",
         },
         {
            accessorKey: "dueDate",
            header: "Due Date",
         },
         {
            header: "Status",
            cell: ({ row }: { row: Row<InvoiceInList> }) => capitalizeFirstLetter(row.original.status),
         },
         {
            accessorKey: "total",
            header: "Total",
         },
         {
            header: "Overdue?",
            cell: ({ row }: { row: Row<InvoiceInList> }) =>
               row.original.isOverdue || row.original.status === "overdue" ? "Yes" : "No",
         },
      ],
      [],
   );

   const table = useReactTable({
      data: filteredInvoices,
      columns,
      pageCount: invoicesData && invoicesData.count > 0 ? Math.ceil(invoicesData.count / pagination.pageSize) : 1,
      state: { pagination },
      onPaginationChange: setPagination,
      manualPagination: true,
      getCoreRowModel: getCoreRowModel(),
      getRowId: (row) => row.id.toString(),
   });

   return (
      <div className="w-full">
         {/* Header */}
         <div className="flex items-center justify-between px-4 py-4 border border-white/10 rounded-t-2xl bg-[#08090a]">
            <div className="flex items-center gap-4">
               <h2 className="text-2xl text-white">Invoice List</h2>
               <div className="text-xs border border-white/20 px-2 py-1 rounded text-white/60">
                  {invoicesData?.count ?? 0} Total
               </div>
            </div>

            <Select
               selectedKeys={statusFilter ? [statusFilter] : []}
               onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as InvoiceStatus | "all";
                  setStatusFilter(selected === "all" ? undefined : selected);
               }}
               placeholder="All Statuses"
               className="w-40"
               classNames={{
                  trigger: "bg-[#0a0b0d] border border-white/20 text-white/80 text-sm",
               }}>
               <SelectItem key="all">All</SelectItem>
               <SelectItem key="draft">Draft</SelectItem>
               <SelectItem key="sent">Sent</SelectItem>
               <SelectItem key="paid">Paid</SelectItem>
               <SelectItem key="cancelled">Cancelled</SelectItem>
               <SelectItem key="overdue">Overdue</SelectItem>
            </Select>
         </div>

         {/* Table */}
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
                           {error instanceof Error ? error.message : "Failed to load invoices."}
                        </td>
                     </tr>
                  ) : invoicesData?.count === 0 ? (
                     <tr>
                        <td colSpan={columns.length} className="py-10 text-center text-white/50">
                           No invoices found.
                        </td>
                     </tr>
                  ) : (
                     table.getRowModel().rows.map((row) => (
                        <tr
                           key={row.id}
                           className="hover:bg-white/5 cursor-pointer transition-colors"
                           onClick={() => navigate(`/invoices/${row.original.id}`)}>
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

         {/* Pagination */}
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

export default InvoicesTable;

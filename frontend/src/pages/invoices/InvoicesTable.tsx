import React, { useMemo, useState } from "react";
import { useInvoices } from "@/hooks/useInvoices.js";
import {
   createColumnHelper,
   useReactTable,
   getCoreRowModel,
   getSortedRowModel,
   getPaginationRowModel,
   flexRender,
} from "@tanstack/react-table";
import type { Invoice } from "@/types/models.js";
import { useNavigate } from "react-router-dom";
import { Select, SelectItem } from "@heroui/react";

const InvoicesTable: React.FC = () => {
   const {
      invoices = [],
      invoicesLoading,
      invoicesError,
      statusFilter,
      setStatusFilter,
      clientFilter,
      setClientFilter,
      projectFilter,
      setProjectFilter,
   } = useInvoices();

   const navigate = useNavigate();
   const [sorting, setSorting] = useState<any[]>([]);
   const [rowSelection, setRowSelection] = useState({});
   const [pageSize, setPageSize] = useState(10);

   const columnHelper = createColumnHelper<Invoice>();

   const columns = useMemo(() => {
      return [
         // Checkbox column
         {
            id: "select",
            header: ({ table }: { table: any }) => (
               <input
                  type="checkbox"
                  checked={table.getIsAllRowsSelected()}
                  onChange={table.getToggleAllRowsSelectedHandler()}
                  className="accent-indigo-500 cursor-pointer"
               />
            ),
            cell: ({ row }: { row: any }) => (
               <input
                  type="checkbox"
                  checked={row.getIsSelected()}
                  onChange={row.getToggleSelectedHandler()}
                  onClick={(e) => e.stopPropagation()}
                  className="accent-indigo-500 cursor-pointer"
               />
            ),
         },
         columnHelper.accessor("invoice_number", { header: "Invoice #" }),
         columnHelper.accessor("client_name", { header: "Client" }),
         columnHelper.accessor("project_name", { header: "Project" }),
         columnHelper.accessor("issue_date", { header: "Issue Date" }),
         columnHelper.accessor("due_date", { header: "Due Date" }),
         columnHelper.accessor("status", { header: "Status" }),
         columnHelper.accessor("total", { header: "Total" }),
         columnHelper.accessor("is_overdue", {
            header: "Overdue?",
            cell: (info) => (info.getValue() ? "Yes" : "No"),
         }),
      ];
   }, [columnHelper]);

   const table = useReactTable({
      data: invoices,
      columns,
      state: { sorting, rowSelection, pagination: { pageIndex: 0, pageSize } },
      onSortingChange: setSorting,
      onRowSelectionChange: setRowSelection,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      enableRowSelection: true,
   });

   const currentPage = table.getState().pagination.pageIndex + 1;
   const totalPages = table.getPageCount();

   return (
      <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#0a0b0d] text-white/90">
         {/* Header + Filters */}
         <div className="flex justify-between items-center px-6 py-4 border-b border-white/10 bg-[#08090a]">
            <div className="flex items-center gap-3">
               <h2 className="text-2xl font-medium text-white/95">Invoices</h2>
               <div className="text-xs rounded-md border border-white/20 px-2 py-1 text-white/60">
                  {invoices.length} Invoices
               </div>
            </div>
            <div className="flex gap-3">
               <Select
                  selectedKeys={statusFilter ? [statusFilter] : []}
                  onSelectionChange={(keys) => {
                     const selected = Array.from(keys)[0] as string;
                     setStatusFilter(selected === "all" ? undefined : selected);
                  }}
                  placeholder="All Statuses"
                  className="w-40"
                  classNames={{
                     trigger: "bg-[#0a0b0d] border border-white/20 text-white/80 text-sm",
                  }}>
                  <SelectItem key="all">All Statuses</SelectItem>
                  <SelectItem key="draft">Draft</SelectItem>
                  <SelectItem key="sent">Sent</SelectItem>
                  <SelectItem key="paid">Paid</SelectItem>
               </Select>
               {/* <input
                  type="number"
                  placeholder="Client ID"
                  value={clientFilter ?? ""}
                  onChange={(e) => setClientFilter(e.target.value ? Number(e.target.value) : undefined)}
                  className="bg-[#0a0b0d] border border-white/20 px-3 py-1 rounded-md text-white/80 text-sm"
               />

               <input
                  type="number"
                  placeholder="Project ID"
                  value={projectFilter ?? ""}
                  onChange={(e) => setProjectFilter(e.target.value ? Number(e.target.value) : undefined)}
                  className="bg-[#0a0b0d] border border-white/20 px-3 py-1 rounded-md text-white/80 text-sm"
               /> */}
            </div>
         </div>

         {/* Table */}
         <table className="min-w-full">
            <thead>
               {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="bg-[#08090a]">
                     {headerGroup.headers.map((header) => (
                        <th
                           key={header.id}
                           className="text-start px-6 py-3 text-white/75 text-sm font-normal cursor-pointer select-none"
                           onClick={header.column.getToggleSortingHandler()}>
                           {flexRender(header.column.columnDef.header, header.getContext())}
                           {{
                              asc: " 🔼",
                              desc: " 🔽",
                           }[header.column.getIsSorted() as string] ?? null}
                        </th>
                     ))}
                  </tr>
               ))}
            </thead>
            <tbody>
               {invoicesLoading && (
                  <tr>
                     <td colSpan={columns.length} className="py-10 text-center text-white/50">
                        Loading...
                     </td>
                  </tr>
               )}
               {!invoicesLoading && invoicesError && (
                  <tr>
                     <td colSpan={columns.length} className="py-10 text-center text-red-400">
                        Error: {invoicesError.message}
                     </td>
                  </tr>
               )}
               {!invoicesLoading && !invoicesError && invoices.length === 0 && (
                  <tr>
                     <td colSpan={columns.length} className="py-10 text-center text-white/60">
                        No invoices found
                     </td>
                  </tr>
               )}
               {!invoicesLoading &&
                  !invoicesError &&
                  table.getRowModel().rows.map((row) => (
                     <tr
                        key={row.id}
                        className={`hover:bg-[#0f1113] transition-all duration-150 cursor-pointer ${
                           row.getIsSelected() ? "bg-[#121417]" : ""
                        }`}
                        onClick={() => navigate(`/invoices/${row.original.id}`)}>
                        {row.getVisibleCells().map((cell) => (
                           <td key={cell.id} className="px-6 py-3 border-t border-white/10 text-sm text-white/80">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                           </td>
                        ))}
                     </tr>
                  ))}
            </tbody>
         </table>

         {/* Pagination */}
         <div className="flex justify-between items-center px-6 py-3 border-t border-white/10 bg-[#08090a] rounded-b-2xl">
            <div className="text-sm text-white/90">
               Page {currentPage} of {totalPages || 1}
            </div>
            <div className="flex gap-3">
               <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage() || invoicesLoading}
                  className="px-3 py-1 border border-white/20 rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
                  Previous
               </button>
               <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage() || invoicesLoading}
                  className="px-3 py-1 border border-white/20 rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
                  Next
               </button>
            </div>
         </div>
      </div>
   );
};

export default InvoicesTable;

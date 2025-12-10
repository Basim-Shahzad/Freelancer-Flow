// import '../Styles/Clients.css'
import React, { useState, useRef, useEffect, useMemo } from "react";
import { CiSearch, CiUser } from "react-icons/ci";
import { MdKeyboardArrowUp } from "react-icons/md";
import { MdKeyboardArrowDown } from "react-icons/md";
import Checkbox from "@mui/material/Checkbox";
import { useMediaQuery } from "usehooks-ts";
import {
   useReactTable,
   getCoreRowModel,
   createColumnHelper,
   flexRender,
   getSortedRowModel,
   getFilteredRowModel,
   getPaginationRowModel,
} from "@tanstack/react-table";
import { useClients } from "../../hooks/useClients.js";

const Clients = () => {
   const isMobile = useMediaQuery("(max-width: 768px)");
   const [columnVisibility, setColumnVisibility] = useState({});
   const [sorting, setSorting] = useState([]);
   const [globalFilter, setGlobalFilter] = useState("");
   const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
   const { clients, clientsError, clientsLoading } = useClients()

   const columnHelper = createColumnHelper();
   const columns = [
      {
         accessorKey: "select",
         size: 24,
         enableSorting: false,
         header: null,
         cell: () => (
            <div className="flex justify-center items-center">
               <Checkbox
                  color="secondary"
                  className="border-2 border-white"
                  sx={{
                     color: "white",
                     "& .MuiSvgIcon-root": { borderColor: "white" },
                  }}
               />
            </div>
         ),
      },
      {
         accessorKey: "name",
         header: (
            <div className="flex items-center gap-1">
               <CiUser />
               Name{" "}
            </div>
         ),
         cell: (props) => <div>{props.getValue()}</div>,
      },
      {
         accessorKey: "email",
         header: (
            <div className="flex items-center gap-1">
               <CiUser />
               Email
            </div>
         ),
         cell: (props) => <div>{props.getValue()}</div>,
      },
   ];

   const table = useReactTable({
      data: clients ?? [],
      columns,
      getCoreRowModel: getCoreRowModel(),

      state: { sorting, globalFilter, pagination },
      onSortingChange: setSorting,
      onGlobalFilterChange: setGlobalFilter,
      onPaginationChange: setPagination,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
   });

   return (
      <div className="bg-[#081028] h-screen flex flex-col px-2.5 items-center overflow-hidden">
         <div className="top-bar xl:w-full py-4 sm:py-8 grid grid-cols-1 xl:grid-cols-2 gap-3 items-center">
            <div className="flex gap-8 items-center xl:justify-center">
               <h1 className="text-xl sm:text-3xl font-mono text-white">Clients</h1>

               <div className="bg-[#0B1739] w-80 items-center h-[42px] flex border-[0.8px] rounded-lg border-slate-100/15">
                  <CiSearch className="text-white/50 text-2xl mx-3" />
                  <input
                     value={globalFilter ?? ""}
                     onChange={(e) => setGlobalFilter(e.target.value)}
                     type="text"
                     className="bg-[#0B1739] w-full h-10  bg-wehite py-3 focus:outline-0 rounded-lg text-slate-50/75 placeholder:select-none"
                     placeholder="Search for..."
                  />
               </div>
            </div>

            <div className="xl:flex xl:w-full xl:justify-end">
               <button className="bg-[rgb(203,60,255)] hover:bg-[rgb(175,60,255)] transition-colors duration-100 cursor-pointer text-[16px] text-white px-8 py-1 xl:mr-7 w-19/20 sm:py-2 rounded-md xl:w-1/3 xl:h-max">
                  Add Client
               </button>
            </div>
         </div>

         <div className="bg-[#0B1739] rounded-2xl w-19/20 h-17/20 border-[0.8px] border-slate-100/15 overflow-">
            <div className="w-full border-b-slate-100/15 px-6 py-6 border-b-[0.8px] flex justify-between items-center sticky top-0 bg-[#0B1739]">
               <h1 className="text-white text-2xl">All Clients</h1>

               <div className="flex gap-2 p-2 text-white">
                  <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                     Prev
                  </button>
                  <span>
                     {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
                  </span>
                  <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                     Next
                  </button>
               </div>
            </div>

            <table className="min-w-full divide-y divide-gray-200/20 text-white/90" width={table.getTotalSize()}>
               <thead className="">
                  {table.getHeaderGroups().map((headerGroup) => (
                     <tr key={headerGroup.id} className="tr sticky top-20 bg-[#0B1739]">
                        {headerGroup.headers.map((header) => (
                           <th
                              key={header.id}
                              onClick={header.column.getToggleSortingHandler()}
                              className="cursor-pointer select-none th"
                              style={{ width: header.column.getSize() }}>
                              <div className="flex items-center gap-1">
                                 {flexRender(header.column.columnDef.header, header.getContext())}
                                 {{
                                    asc: <MdKeyboardArrowUp className="inline-block" />,
                                    desc: <MdKeyboardArrowDown className="inline-block" />,
                                 }[header.column.getIsSorted()] ?? null}
                              </div>
                           </th>
                        ))}
                     </tr>
                  ))}
               </thead>
               <tbody className="">
                  {table.getRowModel().rows.map((row) => (
                     <tr key={row.id} className="tr">
                        {row.getVisibleCells().map((cell) => (
                           <td key={cell.id} className="td" style={{ width: cell.column.getSize() }}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                           </td>
                        ))}
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
   );
};

export default Clients;

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
// import { useProjects } from "../../hooks/useProjects.js";
import { useFormatters } from "../../hooks/useFormatters.js";
import { MdDelete, MdEdit, MdRefresh } from "react-icons/md";
import { Checkbox } from "@heroui/react";
import { data, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectSection, SelectItem } from "@heroui/select";

const ProjectsDataTable = () => {
   const [pagination, setPagination] = useState({
      pageIndex: 0,
      pageSize: 6,
   });
   const { formatDate, formatDueDate } = useFormatters();
   const [rowSelection, setRowSelection] = useState({});
   const navigate = useNavigate();
   const {
      findProjectId,
      createProject,
      isCreating,
      isDeleting,
      isLoading,
      projects,
      error,
      deleteProject,
      projectsTotal,
   } = useProjects(pagination.pageIndex + 1, pagination.pageSize);

   const statusChoices = ["Active", "Completed", "Archived"];

   const columns = [
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
         accessorKey: "hourly_rate",
         header: "Hourly Rate",
         cell: ({ row }) => (
            <div className="text-white/60">{row.original.hourly_rate ? `$${row.original.hourly_rate}` : ""}</div>
         ),
      },
      {
         accessorKey: "price",
         header: "Total Price",
         cell: ({ row }) => <div className="text-white/60">{row.original.price ? `$${row.original.price}` : ""}</div>,
      },
      {
         accessorKey: "due_date",
         header: "Due Date",
         cell: ({ row }) => <div className="text-white/60">{formatDueDate(row.original.due_date)}</div>,
      },
      {
         accessorKey: "client",
         header: "Client",
         cell: ({ row }) => (
            <div className="">
               <div>{row.original.client.name ?? "-"}</div>
               <div className="text-white/60 text-xs">{row.original.client.email ?? ""}</div>
            </div>
         ),
      },
      {
         accessorKey: "status",
         header: "Status",
         cell: ({ row }) => {
            if (row.original.status === "active") {
               return (
                  <div className="flex items-center gap-1 w-max px-1.5 rounded-3xl text-sm py-1">
                     <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>Active
                  </div>
               );
            } else if (row.original.status === "completed") {
               return (
                  <div className="flex items-center gap-1 w-max px-1.5 rounded-3xl text-sm py-1">
                     <div className="w-2 h-2 bg-green-500 rounded-full"></div>Completed
                  </div>
               );
            } else {
               return (
                  <div className="flex items-center gap-1 w-max px-1.5 rounded-3xl text-sm py-1">
                     <div className="w-2 h-2 bg-gray-500 rounded-full"></div>Archived
                  </div>
               );
            }
         },
      },

      {
         id: "actions",
         header: "",
         cell: ({ row }) => (
            <div className="flex items-center gap-2 text-2xl text-white/60">
               <MdDelete
                  className="cursor-pointer hover:text-white hover:bg-white/10 rounded-xl hover:rotate-6"
                  title="Delete"
                  onClick={(e) => {
                     e.stopPropagation();
                     if (confirm("Are you sure you want to delete this project?")) {
                        deleteProject(row.original.id);
                     }
                  }}
               />
            </div>
         ),
      },
   ];

   const table = useReactTable({
      columns,
      data: projects ?? [],
      state: {
         rowSelection,
         pagination,
      },
      onRowSelectionChange: setRowSelection,
      onPaginationChange: setPagination,
      enableRowSelection: true,
      getCoreRowModel: getCoreRowModel(),
      manualPagination: true,
      pageCount: Math.ceil(projectsTotal / pagination.pageSize),
   });

   const currentPage = pagination.pageIndex + 1;
   const totalPages = Math.ceil(projectsTotal / pagination.pageSize);

   return (
      <div className="">
         <div className="TABLE_HEADER gap-2 flex items-center justify-between px-5 py-4 border border-white/10 rounded-t-2xl">
            <div className="flex gap-2 items-center">
               <div className="text-2xl text-white/95 ">All Projects</div>
               <div className="text-xs rounded-md border border-white/4s0 text-white/70 flex h-max w-max px-2 py-1 ">
                  {projectsTotal == 0 ? "No" : projectsTotal} projects
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
               {isLoading && (
                  <tr>
                     <td colSpan={columns.length} className="py-5 text-center text-red-600/70 text-9xl">
                        Loading...
                     </td>
                  </tr>
               )}

               {!isLoading && error && (
                  <tr>
                     <td colSpan={columns.length} className="py-5 text-center text-red-400">
                        {console.log(error)}
                        Error: {error.message}
                     </td>
                  </tr>
               )}

               {!isLoading && !error && projects.length === 0 && (
                  <tr>
                     <td colSpan={columns.length} className="py-5 text-center text-white/70">
                        No projects found
                     </td>
                  </tr>
               )}

               {!isLoading &&
                  !error &&
                  projects.length > 0 &&
                  table.getRowModel().rows.map((row) => (
                     <tr
                        key={row.original.id}
                        className={`${
                           row.getIsSelected() ? "bg-[#08090a]" : ""
                        } hover:bg-[#08090a] transition-all duration-150 cursor-pointer`}
                        onClick={() => {
                           const projectId = row?.original?.id;
                           console.log(row.original);
                           navigate(`/projects/${projectId}`);
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
            <div className="text-white/95 ">
               Page {currentPage} of {totalPages || 1}
            </div>
            <div className="flex gap-6">
               <button
                  className="border border-white/30 rounded-md px-3 py-0.5 cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage() || isLoading}>
                  Previous
               </button>
               <button
                  className="border border-white/30 rounded-md px-3 py-0.5 cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage() || isLoading}>
                  Next
               </button>
            </div>
         </div>
      </div>
   );
};
export default ProjectsDataTable;

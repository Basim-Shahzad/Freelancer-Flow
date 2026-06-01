"use client";

import { useState } from "react";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { ProjectListResponse, ProjectInList } from "../project.types";
import { Avatar, Chip, Pagination } from "@heroui/react";
import { Box } from "lucide-react";
import {
   getInitials,
   formatToMonthDay,
   capitalizeFirstLetter,
   statusChipColor,
   convertMinutesToHoursAndMinutes,
} from "../helper";

interface ProjectsTableProps {
   responseData: ProjectListResponse;
   page: number;
   onPageChange: (page: number) => void;
}

const columnHelper = createColumnHelper<ProjectInList>();

const columns = [
   columnHelper.accessor("name", {
      header: "Name",
      cell: (info) => (
         <div className="select-none flex items-center">
            <Box className="mr-1 w-6 h-6 rounded-[6px] p-1" />
            {info.getValue()}
         </div>
      ),
   }),
   columnHelper.display({
      id: "spacer",
      header: () => null,
      cell: () => null,
   }),
   columnHelper.accessor(row => row.client, {
      header: "Client",
      cell: (info) => (
         <Avatar size="sm" variant="soft" className="select-none">
            <Avatar.Fallback className="text-xs text-white/60 hover:text-white">
               {getInitials(info.row.original.client.name)}
            </Avatar.Fallback>
         </Avatar>
      ),
   }),
   columnHelper.display({
      id: "budget",
      header: "Budget",
      cell: (props) => (
         <span className="select-none">
            {props.row.original.budget}
         </span>
      ),
   }),
   columnHelper.accessor("status", {
      header: "Status",
      cell: (info) => (
         // @ts-ignore
         <Chip className="select-none" variant="soft" color={statusChipColor[info.getValue()]} size="md">
            {capitalizeFirstLetter(info.getValue())}
         </Chip>
      ),
   }),
   columnHelper.accessor("dueDate", {
      header: "Due Date",
      cell: (info) => <span className="select-none">{formatToMonthDay(info.getValue())}</span>,
   }),
   columnHelper.accessor("createdAt", {
      header: "Created At",
      cell: (info) => <span className="select-none">{formatToMonthDay(info.getValue())}</span>,
   }),
];

const LIMIT = 12;

const ProjectsTable: React.FC<ProjectsTableProps> = ({ responseData, page, onPageChange }) => {
   const totalPages = Math.ceil(responseData.total / LIMIT);

   const table = useReactTable({
      data: responseData.projects || [],
      columns,
      getCoreRowModel: getCoreRowModel(),
      manualPagination: true,
      pageCount: totalPages,
   });

   return (
      <main>
         <table className="text-white/80 font-semibold w-full">
            <thead>
               {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                     {headerGroup.headers.map((header) => (
                        <th
                           key={header.id}
                           className={`py-1.5 ${
                              header.id === "spacer" ? "w-100" : header.column.id === "name" ? "px-10" : "px-2"
                           }`}>
                           {header.isPlaceholder ? null : (
                              <p className="text-[12px] transition-all text-white/50 font-medium hover:bg-white/5 hover:text-white/80 w-max px-2 py-1 rounded-xl select-none cursor-pointer">
                                 {flexRender(header.column.columnDef.header, header.getContext())}
                              </p>
                           )}
                        </th>
                     ))}
                  </tr>
               ))}
            </thead>
            <tbody>
               {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/5 transition-colors duration-75">
                     {row.getVisibleCells().map((cell) => (
                        <td
                           key={cell.id}
                           className={`text-[13px] py-1.5 ${
                              cell.column.id === "spacer" ? "w-100" : cell.column.id === "name" ? "px-12" : "px-4"
                           }`}>
                           {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                     ))}
                  </tr>
               ))}
            </tbody>
         </table>

         {totalPages > 1 && (
            <section className="mt-2">
               <Pagination className="flex justify-center items-center">
                  <Pagination.Content>
                     <Pagination.Item>
                        <Pagination.Previous isDisabled={page === 1} onPress={() => onPageChange(page - 1)}>
                           <Pagination.PreviousIcon />
                           <span>Previous</span>
                        </Pagination.Previous>
                     </Pagination.Item>

                     {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <Pagination.Item key={p}>
                           <Pagination.Link isActive={p === page} onPress={() => onPageChange(p)}>
                              {p}
                           </Pagination.Link>
                        </Pagination.Item>
                     ))}

                     <Pagination.Item>
                        <Pagination.Next isDisabled={page === totalPages} onPress={() => onPageChange(page + 1)}>
                           <span>Next</span>
                           <Pagination.NextIcon />
                        </Pagination.Next>
                     </Pagination.Item>
                  </Pagination.Content>
               </Pagination>
            </section>
         )}
      </main>
   );
};

export default ProjectsTable;

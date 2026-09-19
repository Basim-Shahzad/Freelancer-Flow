"use client";

import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { ProjectListResponse, ProjectInList } from "../project.types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
   Pagination,
   PaginationContent,
   PaginationItem,
   PaginationLink,
   PaginationNext,
   PaginationPrevious,
} from "@/components/ui/pagination";
import { Box } from "lucide-react";
import {
   getInitials,
   formatToMonthDay,
   capitalizeFirstLetter,
   statusChipColor,
} from "../helper";

interface ProjectsTableProps {
   responseData: ProjectListResponse;
   page: number;
   onPageChange: (page: number) => void;
}

const columnHelper = createColumnHelper<ProjectInList>();

const STATUS_BADGE_VARIANT: Record<string, "outline" | "secondary" | "default"> = {
   warning: "secondary",
   success: "secondary",
   default: "outline",
};

const columns = [
   columnHelper.accessor("name", {
      header: "Name",
      cell: (info) => (
         <div className="flex items-center select-none">
            <Box className="mr-1.5 h-4 w-4 shrink-0 text-text-muted" />
            {info.getValue()}
         </div>
      ),
   }),
   columnHelper.display({
      id: "spacer",
      header: () => null,
      cell: () => null,
   }),
   columnHelper.accessor((row) => row.client, {
      header: "Client",
      cell: (info) => (
         <Avatar size="sm" className="select-none">
            <AvatarFallback className="text-xs">{getInitials(info.row.original.client.name)}</AvatarFallback>
         </Avatar>
      ),
   }),
   columnHelper.display({
      id: "budget",
      header: "Budget",
      cell: (props) => <span className="select-none">{props.row.original.budget}</span>,
   }),
   columnHelper.accessor("status", {
      header: "Status",
      cell: (info) => (
         <Badge variant={STATUS_BADGE_VARIANT[statusChipColor[info.getValue()]] ?? "outline"} className="select-none">
            {capitalizeFirstLetter(info.getValue())}
         </Badge>
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
      <main className="px-6 py-4">
         <table className="w-full font-medium text-text">
            <thead>
               {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b border-border">
                     {headerGroup.headers.map((header) => (
                        <th
                           key={header.id}
                           className={`py-1.5 text-left ${
                              header.id === "spacer" ? "w-24" : header.column.id === "name" ? "px-2" : "px-2"
                           }`}
                        >
                           {header.isPlaceholder ? null : (
                              <p className="w-max cursor-pointer rounded-md px-2 py-1 text-[12px] font-medium text-text-muted transition-all select-none hover:bg-muted hover:text-text">
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
                  <tr key={row.id} className="border-b border-border/60 transition-colors duration-75 hover:bg-muted/50">
                     {row.getVisibleCells().map((cell) => (
                        <td
                           key={cell.id}
                           className={`py-2 text-[13px] ${cell.column.id === "spacer" ? "w-24" : "px-2"}`}
                        >
                           {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                     ))}
                  </tr>
               ))}
            </tbody>
         </table>

         {totalPages > 1 && (
            <section className="mt-4">
               <Pagination>
                  <PaginationContent>
                     <PaginationItem>
                        <PaginationPrevious
                           aria-disabled={page === 1}
                           className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                           onClick={(e) => {
                              e.preventDefault();
                              onPageChange(page - 1);
                           }}
                        />
                     </PaginationItem>

                     {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <PaginationItem key={p}>
                           <PaginationLink
                              isActive={p === page}
                              className="cursor-pointer"
                              onClick={(e) => {
                                 e.preventDefault();
                                 onPageChange(p);
                              }}
                           >
                              {p}
                           </PaginationLink>
                        </PaginationItem>
                     ))}

                     <PaginationItem>
                        <PaginationNext
                           aria-disabled={page === totalPages}
                           className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                           onClick={(e) => {
                              e.preventDefault();
                              onPageChange(page + 1);
                           }}
                        />
                     </PaginationItem>
                  </PaginationContent>
               </Pagination>
            </section>
         )}
      </main>
   );
};

export default ProjectsTable;

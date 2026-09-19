import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { ClientInList } from "../clients.types";
import ProfilePictureFromName from "@/components/ProfilePictureFromName";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/helpers";

interface ClientsTableProps {
   clients: ClientInList[];
}

const columnHelper = createColumnHelper<ClientInList>();

const columns = [
   columnHelper.accessor("name", {
      header: "Client",
      cell: ({ row, getValue }) => (
         <div className="flex items-center gap-3">
            <ProfilePictureFromName name={getValue()} scale={0.75} />
            <div className="flex flex-col">
               <span className="text-[14px] font-medium text-text">{getValue()}</span>
               <span className="text-[11px] text-text-muted">{row.original.email}</span>
            </div>
         </div>
      ),
   }),
   columnHelper.accessor((row) => row.projects, {
      id: "projects",
      header: "Projects",
      cell: (info) => {
         const projects = info.getValue();
         if (projects.length === 0) {
            return <span className="text-[12px] text-text-muted/60 italic">No projects</span>;
         }
         return (
            <div className="flex flex-wrap gap-1.5">
               {projects.map((project) => (
                  <Badge key={project.id} variant="outline" className="gap-1.5">
                     <span className="size-1.5 shrink-0 rounded-full bg-primary/60" />
                     {project.name}
                  </Badge>
               ))}
            </div>
         );
      },
   }),
   columnHelper.accessor((row) => row.createdAt, {
      id: "joined",
      header: "Joined",
      cell: (info) => <span className="text-[13px] tabular-nums text-text-muted">{formatDate(info.getValue())}</span>,
   }),
   columnHelper.accessor((row) => row.projects, {
      id: "lastSeen",
      header: "Last Seen",
      cell: (info) => {
         const projects = info.getValue();
         return projects.length > 0 ? (
            <span className="text-[13px] tabular-nums text-text-muted">{formatDate(projects[0].createdAt)}</span>
         ) : (
            <span className="text-text-muted/50">—</span>
         );
      },
   }),
];

const ClientsTable: React.FC<ClientsTableProps> = ({ clients }) => {
   const table = useReactTable({
      data: clients || [],
      columns,
      getCoreRowModel: getCoreRowModel(),
   });

   return (
      <table className="w-full px-6 text-text">
         <colgroup>
            <col style={{ width: "220px" }} />
            <col style={{ width: "auto" }} />
            <col style={{ width: "110px" }} />
            <col style={{ width: "110px" }} />
         </colgroup>
         <thead>
            {table.getHeaderGroups().map((headerGroup) => (
               <tr key={headerGroup.id} className="border-b border-border">
                  {headerGroup.headers.map((header, index) => (
                     <th
                        key={header.id}
                        className={`py-2 ${
                           index === 0
                              ? "px-4 pr-6 text-left select-none"
                              : index === 1
                                ? "px-4 text-left"
                                : "px-4 text-right select-none"
                        }`}
                     >
                        {header.isPlaceholder ? null : (
                           <span className="rounded-xl px-[7px] py-[3px] text-[12px] font-medium tracking-wide text-text-muted select-none hover:bg-muted hover:text-text">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                           </span>
                        )}
                     </th>
                  ))}
               </tr>
            ))}
         </thead>
         <tbody>
            {table.getRowModel().rows.map((row) => (
               <tr key={row.id} className="border-b border-border/60 transition-colors duration-75 hover:bg-muted/50">
                  {row.getVisibleCells().map((cell, index) => (
                     <td
                        key={cell.id}
                        className={`py-2.5 ${
                           index === 0 ? "px-4 pr-6 text-left" : index === 1 ? "px-4 text-left" : "px-4 text-right"
                        }`}
                     >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                     </td>
                  ))}
               </tr>
            ))}
         </tbody>
      </table>
   );
};

export default ClientsTable;

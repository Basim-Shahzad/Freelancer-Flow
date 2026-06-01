import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { ClientInList } from "../clients.types";
import ProfilePictureFromName from "@/components/ProfilePictureFromName";
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
               <span className="font-medium text-[14px] text-white/70">{getValue()}</span>
               <span className="text-white/40 text-[11px]">{row.original.email}</span>
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
            return <span className="text-white/25 text-[12px] italic">No projects</span>;
         }
         return (
            <div className="flex flex-wrap gap-1.5">
               {projects.map((project) => (
                  <span
                     key={project.id}
                     className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-white/[0.06] border border-white/[0.08] text-white/60 hover:text-white/85 hover:bg-white/[0.09] transition-all duration-100"
                  >
                     <span className="w-1.5 h-1.5 rounded-full bg-blue-400/60 shrink-0" />
                     {project.name}
                  </span>
               ))}
            </div>
         );
      },
   }),
   columnHelper.accessor((row) => row.createdAt, {
      id: "joined",
      header: "Joined",
      cell: (info) => <span className="text-white/45 text-[13px] tabular-nums">{formatDate(info.getValue())}</span>,
   }),
   columnHelper.accessor((row) => row.projects, {
      id: "lastSeen",
      header: "Last Seen",
      cell: (info) => {
         const projects = info.getValue();
         return projects.length > 0 ? (
            <span className="text-white/45 text-[13px] tabular-nums">{formatDate(projects[0].createdAt)}</span>
         ) : (
            <span className="text-white/25">—</span>
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
      <table className="text-white/80 w-full">
         <colgroup>
            <col style={{ width: "220px" }} />
            <col style={{ width: "auto" }} />
            <col style={{ width: "110px" }} />
            <col style={{ width: "110px" }} />
         </colgroup>
         <thead>
            {table.getHeaderGroups().map((headerGroup) => (
               <tr key={headerGroup.id} className="border-b border-white/[0.06]">
                  {headerGroup.headers.map((header, index) => (
                     <th
                        key={header.id}
                        className={`py-2 ${
                           index === 0 ? "text-left pl-4 pr-6 select-none" : index === 1 ? "text-left px-4" : "text-right px-4 select-none"
                        }`}
                     >
                        {header.isPlaceholder ? null : (
                           <span className="text-[12px] select-none text-white/45 px-[7px] py-[3px] rounded-xl hover:text-white/65 hover:bg-white/10 font-medium tracking-wide">
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
               <tr
                  key={row.id}
                  className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors duration-75"
               >
                  {row.getVisibleCells().map((cell, index) => (
                     <td
                        key={cell.id}
                        className={`py-2.5 ${
                           index === 0 ? "text-left pl-4 pr-6" : index === 1 ? "text-left px-4" : "text-right px-4"
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

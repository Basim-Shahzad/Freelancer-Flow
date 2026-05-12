import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { ClientInList } from "../clients.types";
import ProfilePictureFromName from "@/components/ProfilePictureFromName";
import { formatDate } from "@/lib/helpers";

interface ClientsTableProps {
   clients: ClientInList[];
}

const columnHelper = createColumnHelper<ClientInList>();

function projectUiHelper(projects: { id: string; name: string }[]) {
   if (projects.length === 0) return <span className="">No projects yet</span>;
   let isMoreThenOne = projects.length > 1;
   return (
      <div className="flex gap-1">
         <span>{projects[0].name}</span>
         {isMoreThenOne ? <span className="bg-purple-600 px-2 py-0.5 rounded"> + {projects.length - 1}</span> : ""}
      </div>
   );
}

const columns = [
   columnHelper.accessor("name", {
      header: "Client",
      cell: ({ row, getValue }) => (
         <div className="flex items-center gap-2">
            <ProfilePictureFromName name={getValue()} scale={0.75} />

            <div className="flex flex-col">
               <span>{getValue()}</span>
               <span className="text-white/50 text-[11px]">{row.original.email}</span>
            </div>
         </div>
      ),
   }),

   columnHelper.accessor("phone", {
      header: "Phone",
   }),

   columnHelper.accessor((row) => row.createdAt, {
      id: "Joined",
      header: "Joined",
      cell: (info) => formatDate(info.getValue()),
   }),

   columnHelper.accessor((row) => row.projects, {
      id: "projects",
      header: "Projects",
      cell: ({ row }) => projectUiHelper(row.original.projects),
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
         <thead>
            {table.getHeaderGroups().map((headerGroup) => (
               <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header, index) => (
                     <th className={`text-left px-10 py-1.5`} key={header.id}>
                        {header.isPlaceholder ? null : (
                           <p className="text-[13px] transition-all duration-150 text-white/50 font-medium hover:bg-white/5 hover:text-white/80 w-max px-2 py-1 rounded-xl select-none cursor-pointer">
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
               <tr key={row.id} className="hover:bg-white/5 transition-colors duration-75 select-none">
                  {row.getVisibleCells().map((cell, index) => (
                     <td className={`text-left text-[13px] py-2 px-12`} key={cell.id}>
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

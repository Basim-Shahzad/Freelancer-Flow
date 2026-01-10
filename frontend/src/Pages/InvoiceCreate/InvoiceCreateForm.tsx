import { useState, useMemo, useEffect, useRef } from "react";
import { useProjects } from "@/hooks/useProjects.js";
import { useClients } from "@/hooks/useClients.js";
import { useTimeTracking } from "@/hooks/useTimeTracking.js";
import { formatDuration } from "@/utils/time.utils.js";
import { Select, SelectItem, type Selection } from "@heroui/react";
import { FaPlus } from "react-icons/fa6";
import { useFormatters } from "@/hooks/useFormatters.js";
import { Button } from "@heroui/react";
import { useInvoices } from "@/hooks/useInvoices.js";
import { DatePicker } from "@heroui/react";
import { getLocalTimeZone, today } from "@internationalized/date";
import type { TimeEntry } from "@/types/models.js";
import { useAuth } from "@/Contexts/AuthContext.js";

const InvoiceCreateForm = () => {
   const { user } = useAuth();
   const { projects, projectsLoading } = useProjects();
   const { clients, clientsLoading } = useClients();
   const { timeEntries, timeEntriesLoading } = useTimeTracking();

   // Separate state for client and project
   const [selectedClientId, setSelectedClientId] = useState<Selection>(new Set());
   const [selectedProjectId, setSelectedProjectId] = useState<Selection>(new Set());
   const prevClientIdRef = useRef<Selection>(selectedClientId);
   const prevProjectIdRef = useRef<Selection>(selectedProjectId);

   const { formatCreatedAtDate } = useFormatters();
   const {
      setSelectedProject,
      setInvoiceDueDate,
      setInvoice,
      addItemToInvoice,
      billableEntries,
      setBillableEntries,
      isProjectChangeAllowed,
   } = useInvoices();

   const handleAddEntry = (entry: TimeEntry) => {
      addItemToInvoice(entry);
   };

   // Get selected client
   const selectedClient = useMemo(() => {
      const selectedId = Array.from(selectedClientId)[0];
      if (!selectedId) return null;
      return clients.find((c) => String(c.id) === selectedId);
   }, [selectedClientId, clients]);

   // Get selected project
   const selectedProject = useMemo(() => {
      const selectedId = Array.from(selectedProjectId)[0];
      if (!selectedId) return null;
      return projects.find((p) => String(p.id) === selectedId);
   }, [selectedProjectId, projects]);

   // Filter projects by selected client
   const filteredProjects = useMemo(() => {
      if (!selectedClient) return [];
      return projects.filter((project) => {
         // Handle both nested Client object and client ID
         const projectClientId = typeof project.client === "object" ? project.client?.id : project.client;
         return projectClientId === selectedClient.id;
      });
   }, [selectedClient, projects]);

   useEffect(() => {
      setSelectedProject(selectedProject ?? null);
   }, [selectedProject, setSelectedProject]);

   useEffect(() => {
      if (!selectedProject) {
         setBillableEntries([]);
         return;
      }

      // Filter time entries for the selected project
      const filteredEntries = timeEntries
         .filter((ent) => ent.project.id === selectedProject.id)
         .filter((ent) => ent.is_billable)
         .filter((ent) => ent.duration_minutes !== 0)
         .filter((ent) => !ent.invoiced);

      setBillableEntries(filteredEntries);
   }, [timeEntries, selectedProject, setBillableEntries]);

   if (projectsLoading || clientsLoading || timeEntriesLoading) {
      return <div>Loading...</div>;
   }

   const handleClientSelectionChange = (keys: Selection) => {
      if (!isProjectChangeAllowed) {
         const ok = confirm("Abort invoice and change client?");
         if (!ok) {
            setSelectedClientId(prevClientIdRef.current);
            return;
         }
      }

      prevClientIdRef.current = keys;
      setSelectedClientId(keys);
      // Reset project selection when client changes
      setSelectedProjectId(new Set());
      prevProjectIdRef.current = new Set();
      setInvoice((prev) => (prev ? { ...prev, InvoiceItems: [], items: [] } : prev));
   };

   const handleProjectSelectionChange = (keys: Selection) => {
      if (!isProjectChangeAllowed) {
         const ok = confirm("Abort invoice and change project?");
         if (!ok) {
            setSelectedProjectId(prevProjectIdRef.current);
            return;
         }
      }

      prevProjectIdRef.current = keys;
      setSelectedProjectId(keys);
      setInvoice((prev) => (prev ? { ...prev, InvoiceItems: [], items: [] } : prev));
   };

   return (
      <div className="px-2.5 flex flex-col gap-4">
         <div className="flex gap-4 items-center">
            <Select
               aria-label="clients"
               className="w-1/2"
               size="lg"
               label={"Client"}
               placeholder="Select a Client"
               selectedKeys={selectedClientId}
               isRequired
               onSelectionChange={handleClientSelectionChange}
               variant="bordered">
               {clients.map((client) => (
                  <SelectItem key={String(client.id)} textValue={`${client.name}`}>
                     <span className="font-bold">{client.name}</span>
                  </SelectItem>
               ))}
            </Select>

            <Select
               aria-label="projects"
               className="w-1/2"
               size="lg"
               label={"Project"}
               placeholder="Select a Project"
               selectedKeys={selectedProjectId}
               onSelectionChange={handleProjectSelectionChange}
               variant="bordered"
               isDisabled={!selectedClient}
               disallowEmptySelection={false}>
               {filteredProjects.map((proj) => (
                  <SelectItem key={String(proj.id)} textValue={`${proj.name}`}>
                     <span className="font-bold">{proj.name}</span>
                  </SelectItem>
               ))}
            </Select>

            <DatePicker
               isRequired={true}
               aria-label="due date"
               className="w-1/2"
               size="md"
               label={"Due Date"}
               onChange={(e) => {
                  if (!e) return;
                  const formatted = `${e.year}-${String(e.month).padStart(2, "0")}-${String(e.day).padStart(2, "0")}`;
                  setInvoiceDueDate(formatted);
                  setInvoice((prev) => (prev ? { ...prev, due_date: formatted } : prev));
               }}
               showMonthAndYearPickers
               minValue={today(getLocalTimeZone())}
               maxValue={today(getLocalTimeZone()).add({ years: 10 })}
               errorMessage={(value) => {
                  if (value.isInvalid) {
                     return "Please enter a valid date.";
                  }
               }}
            />
         </div>

         <div className="grid grid-cols-2 flex-col gap-1.5 items-center">
            {billableEntries.map((entry) => (
               <div
                  className="px-3 border border-white/20 flex items-center justify-between py-3 rounded-xl"
                  key={entry.id}>
                  <div>
                     <div className="text-lg font-semibold">{entry.description ? entry.description : "Time Entry"}</div>
                     <div className="text-xs">{formatCreatedAtDate(entry.created_at)}</div>
                  </div>
                  <div className="flex items-center gap-2.5">
                     <div className="text-lg">{formatDuration(entry.duration_minutes)}</div>
                     <FaPlus
                        onClick={() => handleAddEntry(entry)}
                        className="text-2xl bg-green-900 px-0.5 py-0.5 rounded-xs text-green-500 cursor-pointer"
                     />
                  </div>
               </div>
            ))}
         </div>
         <Button color="default" variant="bordered" className="w-1/3" startContent={<FaPlus />}>
            Add custom Item
         </Button>
      </div>
   );
};

export default InvoiceCreateForm;
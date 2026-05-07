import React, { type Key } from "react";
import { Autocomplete, AutocompleteItem } from "@heroui/react";
import { useClients } from "@/features/clients/hooks.js";
import type { nonPaginatedClientListResponse } from "@/features/clients/types.js";
import { useCreateInvoiceStore } from "../store.js";

interface ClientSelectorProps {
   clientsData: nonPaginatedClientListResponse | undefined;
   clientsLoading: boolean;
   clientsError: Error | null;
}

const ClientSelector: React.FC<ClientSelectorProps> = ({ clientsData, clientsError, clientsLoading }) => {
   const clients = clientsData?.clients ?? [];

   const setSelectedClientId = useCreateInvoiceStore((state) => state.setSelectedClientId);
   const selectedClientId = useCreateInvoiceStore((state) => state.selectedClientId);

   function onSelectedClientChange(clientId: any) {
      setSelectedClientId(clientId);
   }

   if (clientsError || clientsError != null) {
      return (
         <Autocomplete
            isDisabled
            className=""
            label="Select a Client"
            placeholder="Error loading clients"
            errorMessage="Could not load data"
            isInvalid>
            {[]}
         </Autocomplete>
      );
   }

   return (
      <div className="w-full">
         <Autocomplete
            className=""
            variant="bordered"
            size="sm"
            label="Client"
            placeholder="Search for a client..."
            onSelectionChange={onSelectedClientChange}
            isLoading={clientsLoading}
            defaultItems={clients}
            isRequired>
            {(client) => (
               <AutocompleteItem key={client.id} textValue={client.name}>
                  <div className="flex flex-col">
                     <span className="text-sm">{client.name}</span>
                  </div>
               </AutocompleteItem>
            )}
         </Autocomplete>
      </div>
   );
};

export default ClientSelector;

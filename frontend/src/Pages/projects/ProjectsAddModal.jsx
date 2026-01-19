import React, { useEffect } from "react";
import {
   Modal,
   ModalContent,
   ModalHeader,
   ModalBody,
   ModalFooter,
   Button,
   Input,
   DateInput,
   Select,
   SelectItem,
} from "@heroui/react";
import { useClients } from "@/features/clients/hooks.js";
import { useFormatters } from "../../hooks/useFormatters.js";
import { useProjects } from "@/hooks/useProjects.js";
import { useForm, Controller } from "react-hook-form";

const ProjectsAddModal = ({ isOpen, onOpenChange }) => {
   const { data: response, isLoading: clientsLoading } = useClients();
   const clients = response?.items ?? [];
   const { createProject, error  } = useProjects();
   const { formatDueDateForServer } = useFormatters();
   const {  
      register,
      handleSubmit,
      formState: { errors },
      control,
   } = useForm();

   const onSubmit = async (projectData) => {
      const formatted = {
         ...projectData,
         due_date: formatDueDateForServer(projectData.due_date),
      };

      await createProject(formatted);
      onOpenChange(false);
   };

   return (
      <Modal
         isOpen={isOpen}
         onOpenChange={onOpenChange}
         placement="top-center"
         className="bg-black border border-white/10 h-max"
         size="xl">
         <ModalContent>
            {(onClose) => (
               <>
                  <ModalHeader>
                     <div className="text-2xl py-1.5">Create Project</div>
                  </ModalHeader>

                  <ModalBody>
                     <Input
                        label="Project Name"
                        type="text"
                        isRequired
                        {...register("name", { required: "Project Name is required" })}
                     />
                     {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}

                     <div className="flex gap-2.5 items-center">
                        <Controller
                           name="client_id"
                           control={control}
                           rules={{ required: "Client is required" }}
                           render={({ field }) => (
                              <Select
                                 label="Client"
                                 isRequired
                                 className="w-2/3"
                                 selectedKeys={field.value ? [field.value] : []}
                                 onSelectionChange={(keys) => field.onChange(Array.from(keys)[0])}
                                 items={clients}>
                                 {(client) => <SelectItem key={client.id}>{client.name}</SelectItem>}
                              </Select>
                           )}
                        />
                        {errors.client && <p className="text-sm text-red-600">{errors.client.message}</p>}
                        <Controller
                           name="due_date"
                           control={control}
                           render={({ field }) => (
                              <DateInput
                                 label="Due Date"
                                 value={field.value}
                                 onChange={field.onChange}
                                 className="w-1/3"
                                 isRequired
                              />
                           )}
                        />
                     </div>

                     <div className="flex gap-2.5 items-center">
                        <Input
                           className="w-"
                           label="Hourly Rate"
                           placeholder="0.00"
                           {...register("hourly_rate")}
                           startContent={
                              <div className="pointer-events-none flex items-center">
                                 <span className="text-default-400 text-small">$</span>
                              </div>
                           }
                           type="number"
                        />
                     </div>
                  </ModalBody>

                  <ModalFooter>
                     <div className="flex items-center justify-center w-full">
                        <Button
                           color="primary"
                           className="w-1/4"
                           onPress={async () => {
                              await handleSubmit(onSubmit)();
                           }}>
                           Create
                        </Button>
                     </div>
                  </ModalFooter>
               </>
            )}
         </ModalContent>
      </Modal>
   );
};

export default ProjectsAddModal;

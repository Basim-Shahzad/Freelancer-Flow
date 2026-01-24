import React from "react";
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
import { useFormatters } from "../../../hooks/useFormatters.js";
import { useCreateProject } from "../hooks.js";
import { useForm, Controller } from "react-hook-form";

type ProjectFormData = {
   name: string;
   client_id: string | number;
   due_date: any;
   hourly_rate?: number;
};

const ProjectsAddModal = ({ isOpen, onOpenChange }) => {
   const { data: response, isLoading: clientsLoading } = useClients();
   const clients = response?.items ?? [];
   const { mutate: createProject, isPending } = useCreateProject();
   const { formatDueDateForServer } = useFormatters();
   const {
      register,
      handleSubmit,
      formState: { errors },
      control,
      reset,
   } = useForm<ProjectFormData>();

   const onSubmit = async (projectData: ProjectFormData) => {
      const formatted = {
         ...projectData,
         due_date: formatDueDateForServer(projectData.due_date),
      };

      createProject(formatted, {
         onSuccess: () => {
            reset();
            onOpenChange(false);
         },
      });
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
                        isInvalid={!!errors.name}
                        errorMessage={errors.name?.message}
                     />

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
                                 selectedKeys={field.value ? [field.value.toString()] : []}
                                 onSelectionChange={(keys) => field.onChange(Array.from(keys)[0])}
                                 items={clients}
                                 isLoading={clientsLoading}
                                 isInvalid={!!errors.client_id}
                                 errorMessage={errors.client_id?.message}>
                                 {(client) => <SelectItem key={client.id}>{client.name}</SelectItem>}
                              </Select>
                           )}
                        />
                        <Controller
                           name="due_date"
                           control={control}
                           rules={{ required: "Due date is required" }}
                           render={({ field }) => (
                              <DateInput
                                 label="Due Date"
                                 value={field.value}
                                 onChange={field.onChange}
                                 className="w-1/3"
                                 isRequired
                                 isInvalid={!!errors.due_date}
                                 errorMessage={errors.due_date?.message}
                              />
                           )}
                        />
                     </div>

                     <div className="flex gap-2.5 items-center">
                        <Input
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
                           isLoading={isPending}
                           onPress={async () => {
                              await handleSubmit(onSubmit)();
                           }}>
                           {isPending ? "Creating..." : "Create"}
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

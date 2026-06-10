import React from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input } from "@heroui/react";
import { useForm } from "react-hook-form";
import { useCreateClient } from "../hooks.js";
import type { Client } from "../types.js";

type ClientsAddModalProps = {
   isOpen: boolean;
   onOpenChange: (open: boolean) => void;
};

type ClientFormData = Omit<Client, "id" | "created_at" | "updated_at" | "user">;

const ClientsAddModal = ({ isOpen, onOpenChange }: ClientsAddModalProps) => {
   const { mutate: createClient, isPending: isCreatingClient } = useCreateClient();

   const {
      register,
      handleSubmit,
      formState: { errors },
      reset,
   } = useForm<ClientFormData>();

   const onSubmit = async (clientData: ClientFormData) => {
      createClient(clientData, {
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
                     <div className="text-2xl py-1.5">Create Client</div>
                  </ModalHeader>

                  <ModalBody>
                     <Input
                        label="Name"
                        type="text"
                        isRequired
                        {...register("name", { required: "Client Name is required" })}
                        isInvalid={!!errors.name}
                        errorMessage={errors.name?.message}
                     />

                     <Input
                        label="Email"
                        type="email"
                        {...register("email")}
                        isInvalid={!!errors.email}
                        errorMessage={errors.email?.message}
                     />
                  </ModalBody>

                  <ModalFooter>
                     <div className="flex items-center justify-center w-full">
                        <Button
                           color="secondary"
                           variant="flat"
                           className="w-full"
                           isLoading={isCreatingClient}
                           onPress={async () => {
                              await handleSubmit(onSubmit)();
                           }}>
                           {isCreatingClient ? "Creating" : "Create"}
                        </Button>
                     </div>
                     <div className="flex items-center justify-center w-full">
                        <Button color="secondary" variant="flat" className="w-full">
                           Add billing Address
                        </Button>
                     </div>
                  </ModalFooter>
               </>
            )}
         </ModalContent>
      </Modal>
   );
};

export default ClientsAddModal;

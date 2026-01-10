import React, { useEffect } from "react";
import {
   Modal,
   ModalContent,
   ModalHeader,
   ModalBody,
   ModalFooter,
   Button,
   Input,
} from "@heroui/react";
import { useClients } from "../../hooks/useClients.js";
import { useFormatters } from "../../hooks/useFormatters.js";
import { useForm } from "react-hook-form";

type ClientsAddModalProps = {
   isOpen: boolean;
   onOpenChange: (open: boolean) => void;
};

const ClientsAddModal = ({ isOpen, onOpenChange }: ClientsAddModalProps) => {
   const { createClient, isCreatingClient } = useClients();
   const { formatDueDateForServer } = useFormatters();
   const {
      register,
      handleSubmit,
      formState: { errors },
      control,
      reset,
   } = useForm();

   const onSubmit = async (clientData: {}) => {
      await createClient(clientData);
      reset();
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
                     <div className="text-2xl py-1.5">Create Client</div>
                  </ModalHeader>

                  <ModalBody>
                     <Input
                        label="Name"
                        type="text"
                        isRequired
                        {...register("name", { required: "Client Name is required" })}
                     />
                     {errors.root && <p className="text-sm text-red-600">{errors.root?.message}</p>}

                     <Input label="Email" type="text" {...register("email")} />
                     {errors.root && <p className="text-sm text-red-600">{errors.root?.message}</p>}
                  </ModalBody>

                  <ModalFooter>
                     <div className="flex items-center justify-center w-full">
                        <Button
                           color="secondary"
                           variant="flat"
                           className="w-full"
                           onPress={async () => {
                              await handleSubmit(onSubmit)();
                           }}>
                           {isCreatingClient ? "Creating" : "Create"}
                        </Button>
                     </div>
                     <div className="flex items-center justify-center w-full">
                        <Button color="secondary" variant="flat" className="w-full">
                           Add billing Adress
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

"use client";

import { use } from "react";

import Header from "@/components/Header";
import ProjectInfo from "./components/ProjectInfo";
import ProjectDescription from "./components/ProjectDescription";
import ProjectActivity from "./components/ProjectActivity";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { useProjects } from "../useProjects";
import { useQuery } from "@tanstack/react-query";

function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
   const { id } = use(params);
   const { data: res, isLoading } = useQuery({
      queryKey: ["project", id],
      queryFn: () => useProjects.get(id),
   });

   if (isLoading) {
      return (
         <main className="flex h-full flex-col">
            <Header title="Loading…" />
            <div className="flex flex-1 items-center justify-center py-24">
               <Spinner className="size-6 text-primary" />
            </div>
         </main>
      );
   }

   const project = res?.data!;

   return (
      <main className="flex h-full flex-col">
         <Header title={project?.name} />

         <ProjectInfo project={project} />

         <Tabs defaultValue="overview" className="px-16">
            <TabsList variant="line">
               <TabsTrigger value="overview">Overview</TabsTrigger>
               <TabsTrigger value="time-tracking">Time Tracking</TabsTrigger>
               <TabsTrigger value="invoices">Invoices</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
               <ProjectDescription project={project} />
            </TabsContent>
            <TabsContent value="time-tracking">
               <ProjectActivity project={project} />
            </TabsContent>
            <TabsContent value="invoices">
               <div className="py-6 text-sm text-text-muted">Invoices Content</div>
            </TabsContent>
         </Tabs>
      </main>
   );
}

export default ProjectDetailPage;

import Sidebar from "../../components/Sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
   return (
      <div className="flex min-h-screen bg-background text-text">
         <aside className="fixed top-0 left-0 z-20 h-screen w-[250px]">
            <Sidebar />
         </aside>
         <main className="mt-2 mr-4 mb-4 ml-[266px] flex flex-1 flex-col rounded-xl border border-border bg-surface">
            {children}
         </main>
      </div>
   );
}

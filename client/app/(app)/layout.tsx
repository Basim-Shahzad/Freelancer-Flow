import Sidebar from "../../components/Sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {

   return (
      <div className="flex min-h-screen bg-black">
         <aside className="w-[232px] h-screen fixed top-0 left-0 z-20">
            <Sidebar />
         </aside>
         <main className="flex-1 ml-[232px] min-h-screen flex flex-col">
            {children}
         </main>
      </div>
   );
}

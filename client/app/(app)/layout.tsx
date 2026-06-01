import Sidebar from "../../components/Sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
   return (
      <div className="flex min-h-screen bg-black text-white">
         <aside className="w-[250px] h-screen fixed top-0 left-0 z-20">
            <Sidebar />
         </aside>
         <main className="flex-1 bg-[#0F1010] rounded-xl ml-[260px] mr-[16px] mt-[8px] mb-[16px] flex flex-col border border-white/5">
            {children}
         </main>
      </div>
   );
}

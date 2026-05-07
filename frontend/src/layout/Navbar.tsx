import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store.js";
import { useLogout } from "@/features/auth/hooks.js";
import { Button } from "@heroui/react";
import logo from "../../public/logo.svg";
import { Link } from "react-router-dom";
import ProfilePictureFromName from "@/UiComponents/ProfilePictureFromName.js";

const links = [
   { name: "Dashboard", link: "dashboard" },
   { name: "Features", link: "dashboard" },
   { name: "Pricing", link: "dashboard" },
   { name: "Contact", link: "dashboard" },
];

const Navbar = () => {
   const navigate = useNavigate();
   const user = useAuthStore((state) => state.user);
   // const user = {
   //    username: "Basim Shahzad",
   // };
   const { mutate: logout, isPending } = useLogout();

   return (
      <div className="bg-black border-b-[0.8px] border-white/10 text-white z-50 flex justify-between items-center px-12 py-2">
         <div className="flex items-center">
            <img src={logo} className="w-12 select-none" />
            <h1 className="text-xl select-none">Paylancr</h1>
         </div>

         <div className="flex gap-8 items-center">
            <div className="text-[13px] items-center flex gap-8  ">
               {links.map((l) => (
                  <Link to={l.link} className="text-white/50 hover:text-white/90 transition-all duration-200">
                     {l.name}
                  </Link>
               ))}
            </div>

            <div className="border border-white/5 h-6"></div>

            <div className="flex gap-2 h-full">
               {user ? (
                  <div className="flex items-center justify-center gap-2 h-full">
                     <Button
                        onPress={() => logout()}
                        disabled={isPending}
                        size="sm"
                        isLoading={isPending}
                        className={`bg-white text-black text-xs rounded-full`}>
                        {isPending ? "Logging out..." : "Logout"}
                     </Button>
                     <ProfilePictureFromName name={user.username} scale={0.8} />
                  </div>
               ) : null}

               <Button
                  onPress={() => navigate("/login")}
                  variant="bordered"
                  size="sm"
                  className={`${user ? "hidden" : ""} rounded-full text-xs `}>
                  Log in
               </Button>

               <Button
                  onPress={() => navigate("/login")}
                  size="sm"
                  className={`${user ? "hidden" : ""} rounded-full bg-white text-black text-xs`}>
                  Sign Up
               </Button>
            </div>
         </div>
      </div>
   );
};

export default Navbar;

import { useState } from "react";
import bgimg from "../assets/bg-img2.jpg";
import dashboard from "../assets/db.png";
import { Link, useLocation } from "react-router-dom";
import { AiFillBackward } from "react-icons/ai";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/Contexts/AuthContext.js";

export const Login = () => {
   const location = useLocation();
   const isPathSignup = location.pathname == "/signup" ? true : false;
   const [isSignupClicked, setIsSignupClicked] = useState(isPathSignup ? true : false);
   const [isLoginClicked, setIsLoginClicked] = useState(isPathSignup ? false : true);
   const navigate = useNavigate();

   const { login, signup, error } = useAuth();

   const {
      register,
      handleSubmit,
      formState: { errors },
   } = useForm();

   const buttonClick = () => {
      setIsSignupClicked(!isSignupClicked);
      setIsLoginClicked(!isLoginClicked);
   };

   const onSubmit = async (data) => {
      if (isPathSignup) {
         const result = await signup(data);
         if (result.success) {
            navigate("/dashboard");
         }
      } else {
         const result = await login(data);
         if (result.success) {
            navigate("/dashboard");
         }
      }
   };

   return (
      <div className="grid grid-cols-1 lg:grid-cols-5 h-screen w-screen">
         <div className="dark:bg-[#0C0E12] col-span-2 flex items-center justify-center flex-col">
            <div className="w-3/4 sm:w-1/2 lg:w-3/5">
               <div className="flex items-center gap-1.5 p-3 justify-center">
                  <div className="w-8 h-8 rounded-md flex items-center justify-center bg-linear-to-br from-[#7c3aed] to-[#2dd4bf] text-white font-bold select-none">
                     FF
                  </div>
                  <h1 className="text-white font-satoshi text-2xl ">FreelancerFlow</h1>
               </div>
               <div className="text-2xl text-white flex gap-2 flex-col items-center font-bold">
                  <div>{isPathSignup && isSignupClicked ? "Create an Account" : "Log in to your account"}</div>
                  <p className="text-white/50 text-sm font-normal">
                     Welcome, {isPathSignup && isSignupClicked ? "" : "back!"} Please enter your details.
                  </p>
               </div>
               <div className="w-full flex mt-5">
                  <button
                     className={`w-1/2 border border-white/30 text-sm px-0.5 py-1 rounded-sm cursor-pointer ${
                        isSignupClicked ? "bg-gray-500/25 border-white/50 text-white/75" : "text-white/50"
                     }`}
                     onClick={() => {
                        buttonClick();
                        navigate("/signup");
                     }}>
                     Sign up
                  </button>
                  <button
                     className={`w-1/2 border border-white/30 text-sm px-0.5 py-1 rounded-sm cursor-pointer  ${
                        isLoginClicked ? "bg-gray-500/25 border-white/50 text-white/75" : "text-white/50"
                     }`}
                     onClick={() => {
                        buttonClick();
                        navigate("/login");
                     }}>
                     Log in
                  </button>
               </div>

               <form onSubmit={handleSubmit(onSubmit)} autoComplete="on">
                  <div className="flex flex-col gap-2.5 mt-4">
                     {isSignupClicked ? (
                        <div>
                           <label htmlFor="username" className="block text-sm font-medium text-white/75">
                              Username
                           </label>
                           <input
                              type="text"
                              id="username"
                              autoComplete="username"
                              // value={email}
                              // onChange={(e) => setEmail(e.target.value)}
                              placeholder="Enter your username"
                              className="w-full px-4 py-2 bg-transparent border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-500 transition-all duration-200"
                              {...register("username", { required: true })}
                           />
                        </div>
                     ) : (
                        ""
                     )}
                     <div>
                        <label htmlFor="email" className="block text-sm font-medium text-white/75">
                           Email
                        </label>
                        <input
                           type="email"
                           id="email"
                           autoComplete="email"
                           placeholder="Enter your email"
                           className="w-full px-4 py-2 bg-transparent border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-500 transition-all duration-200"
                           {...register("email", { required: true })}
                        />
                     </div>
                     <div>
                        <label htmlFor="password" className="block text-sm font-medium text-white/75">
                           Password
                        </label>
                        <input
                           type="password"
                           id="password"
                           placeholder="••••••••"
                           autoComplete={isSignupClicked ? "new-password" : "current-password"}
                           className="w-full px-4 py-2 bg-transparent border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-500 transition-all duration-200"
                           {...register("password", { required: true })}
                        />
                     </div>
                     {error && <div className="text-red-500 text-sm">{error}</div>}
                     {errors.username && <span className="text-red-500 text-sm">Username is required</span>}
                     {errors.email && <span className="text-red-500 text-sm">Email is required</span>}
                     {errors.password && <span className="text-red-500 text-sm">Password is required</span>}
                  </div>

                  <div className="flex items-center justify-end my-3">
                     <a href="#" className="text-sm text-gray-300 hover:text-white transition">
                        Forgot password?
                     </a>
                  </div>

                  <div className="flex flex-col gap-2.5">
                     <button
                        type="submit"
                        className="w-full py-2 text-white/80 cursor-pointer from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 rounded-lg font-medium shadow-lg shadow-purple-500/30 transition duration-200">
                        Sign {isPathSignup && isSignupClicked ? "up" : "in"}
                     </button>

                     <button
                        type="button"
                        className="w-full text-white/80 py-2 bg-transparent cursor-pointer border border-gray-700 hover:border-gray-600 rounded-lg font-medium flex items-center justify-center gap-3 transition-all duration-200">
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                           <path
                              fill="#4285F4"
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                           />
                           <path
                              fill="#34A853"
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                           />
                           <path
                              fill="#FBBC05"
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                           />
                           <path
                              fill="#EA4335"
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                           />
                        </svg>
                        <span>Sign in with Google</span>
                     </button>
                  </div>
               </form>
               <Link className="text-white fixed bottom-0 left-0 px-2 py-3 flex gap-1 items-center" to={"/"}>
                  <AiFillBackward />
                  Go back
               </Link>
            </div>
         </div>

         <div className="dark:bg-[#22262F] col-span-3 overflow-hidden relative z-10">
            <img
               src={bgimg}
               alt="Background"
               className="hidden lg:block absolute w-full h-full object-cover opacity-70 select-none cursor-default -z-50"
            />

            <div className="text-white hidden lg:block fixed -bottom-55 -right-3/12 w-4/5 rounded-4xl">
               <img src={dashboard} className="rounded-4xl border-2 border-white/10" />
            </div>
         </div>
      </div>
   );
};

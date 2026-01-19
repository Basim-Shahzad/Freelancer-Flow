import { useState } from "react";
import bgimg from "../assets/bg-img2.jpg";
import dashboard from "../assets/db.png";
import { Link, useLocation } from "react-router-dom";
import { AiFillBackward } from "react-icons/ai";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useSignup } from "@/features/auth/hooks.js";
import { Button } from "@heroui/react";

export const SignupPage = () => {
   const location = useLocation();
   const isPathSignup = location.pathname === "/signup";
   const [isSignupClicked, setIsSignupClicked] = useState(isPathSignup);
   const [isLoginClicked, setIsLoginClicked] = useState(!isPathSignup);
   const navigate = useNavigate();
   const { mutate: signup, isPending } = useSignup();

   const {
      register,
      handleSubmit,
      formState: { errors },
      watch,
   } = useForm({
      mode: "onBlur",
   });

   const password = watch("password");

   const onSubmit = async (data) => {
      try {
         signup(data);
      } catch (error) {
         console.error("Signup submission error:", error);
      }
   };

   return (
      <div className="grid grid-cols-1 lg:grid-cols-5 h-screen w-screen">
         <div className="dark:bg-[#0C0E12] col-span-2 flex items-center justify-center flex-col">
            <div className="w-3/4 sm:w-1/2 lg:w-3/5">
               <div className="flex items-center gap-1.5 p-3 justify-center">
                  <div className="w-8 h-8 rounded-md flex items-center justify-center bg-gradient-to-br from-[#7c3aed] to-[#2dd4bf] text-white font-bold select-none">
                     FF
                  </div>
                  <h1 className="text-white font-satoshi text-2xl">FreelancerFlow</h1>
               </div>
               <div className="text-2xl text-white flex gap-2 flex-col items-center font-bold">
                  <div>{isPathSignup && isSignupClicked ? "Create an Account" : "Log in to your account"}</div>
                  <p className="text-white/50 text-sm font-normal">Welcome, Please enter your details.</p>
               </div>
               <div className="w-full flex mt-5">
                  <button
                     type="button"
                     disabled={isPending}
                     className={`w-1/2 border border-white/30 text-sm px-0.5 py-1 rounded-sm cursor-pointer transition-all ${
                        isSignupClicked ? "bg-gray-500/25 border-white/50 text-white/75" : "text-white/50"
                     } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
                     onClick={() => {
                        if (!isPending) {
                           setIsSignupClicked(true);
                           setIsLoginClicked(false);
                           navigate("/signup");
                        }
                     }}
                     aria-label="Switch to Sign up"
                  >
                     Sign up
                  </button>
                  <button
                     type="button"
                     disabled={isPending}
                     className={`w-1/2 border border-white/30 text-sm px-0.5 py-1 rounded-sm cursor-pointer transition-all ${
                        isLoginClicked ? "bg-gray-500/25 border-white/50 text-white/75" : "text-white/50"
                     } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
                     onClick={() => {
                        if (!isPending) {
                           setIsLoginClicked(true);
                           setIsSignupClicked(false);
                           navigate("/login");
                        }
                     }}
                     aria-label="Switch to Log in"
                  >
                     Log in
                  </button>
               </div>

               <form onSubmit={handleSubmit(onSubmit)} autoComplete="on" noValidate>
                  <div className="flex flex-col gap-2.5 mt-4">
                     <div>
                        <label htmlFor="username" className="block text-sm font-medium text-white/75">
                           Username
                        </label>
                        <input
                           type="text"
                           id="username"
                           autoComplete="username"
                           disabled={isPending}
                           placeholder="Enter your username"
                           className={`w-full px-4 py-2 bg-transparent border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-500 transition-all duration-200 ${
                              isPending ? "opacity-50 cursor-not-allowed" : ""
                           } ${errors.username ? "border-red-500 focus:ring-red-500" : ""}`}
                           aria-invalid={errors.username ? "true" : "false"}
                           aria-describedby={errors.username ? "username-error" : undefined}
                           {...register("username", {
                              required: "Username is required",
                              minLength: {
                                 value: 3,
                                 message: "Username must be at least 3 characters",
                              },
                              maxLength: {
                                 value: 30,
                                 message: "Username must be less than 30 characters",
                              },
                              pattern: {
                                 value: /^[a-zA-Z0-9_-]+$/,
                                 message: "Username can only contain letters, numbers, underscores and hyphens",
                              },
                           })}
                        />
                        {errors.username && (
                           <span id="username-error" className="text-red-500 text-sm mt-1 block" role="alert">
                              {errors.username.message as string}
                           </span>
                        )}
                     </div>
                     <div>
                        <label htmlFor="email" className="block text-sm font-medium text-white/75">
                           Email
                        </label>
                        <input
                           type="email"
                           id="email"
                           autoComplete="email"
                           disabled={isPending}
                           placeholder="Enter your email"
                           className={`w-full px-4 py-2 bg-transparent border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-500 transition-all duration-200 ${
                              isPending ? "opacity-50 cursor-not-allowed" : ""
                           } ${errors.email ? "border-red-500 focus:ring-red-500" : ""}`}
                           aria-invalid={errors.email ? "true" : "false"}
                           aria-describedby={errors.email ? "email-error" : undefined}
                           {...register("email", {
                              required: "Email is required",
                              pattern: {
                                 value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                 message: "Invalid email address",
                              },
                           })}
                        />
                        {errors.email && (
                           <span id="email-error" className="text-red-500 text-sm mt-1 block" role="alert">
                              {errors.email.message as string}
                           </span>
                        )}
                     </div>
                     <div>
                        <label htmlFor="password" className="block text-sm font-medium text-white/75">
                           Password
                        </label>
                        <input
                           type="password"
                           id="password"
                           disabled={isPending}
                           placeholder="••••••••"
                           autoComplete="new-password"
                           className={`w-full px-4 py-2 bg-transparent border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-500 transition-all duration-200 ${
                              isPending ? "opacity-50 cursor-not-allowed" : ""
                           } ${errors.password ? "border-red-500 focus:ring-red-500" : ""}`}
                           aria-invalid={errors.password ? "true" : "false"}
                           aria-describedby={errors.password ? "password-error" : undefined}
                           {...register("password", {
                              required: "Password is required",
                              minLength: {
                                 value: 8,
                                 message: "Password must be at least 8 characters",
                              },
                              pattern: {
                                 value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                                 message: "Password must contain uppercase, lowercase, and number",
                              },
                           })}
                        />
                        {errors.password && (
                           <span id="password-error" className="text-red-500 text-sm mt-1 block" role="alert">
                              {errors.password.message as string}
                           </span>
                        )}
                        {password && password.length > 0 && !errors.password && (
                           <div className="mt-2 space-y-1">
                              <div className="flex items-center gap-2">
                                 <div
                                    className={`h-1 flex-1 rounded ${
                                       password.length >= 8 ? "bg-green-500" : "bg-gray-600"
                                    }`}
                                 />
                                 <div
                                    className={`h-1 flex-1 rounded ${
                                       /[A-Z]/.test(password) && /[a-z]/.test(password) ? "bg-green-500" : "bg-gray-600"
                                    }`}
                                 />
                                 <div
                                    className={`h-1 flex-1 rounded ${/\d/.test(password) ? "bg-green-500" : "bg-gray-600"}`}
                                 />
                              </div>
                              <p className="text-xs text-gray-400">
                                 Password strength: {password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) ? "Strong" : password.length >= 8 ? "Medium" : "Weak"}
                              </p>
                           </div>
                        )}
                     </div>
                  </div>

                  <div className="flex items-center justify-end my-3">
                     <button
                        type="button"
                        disabled={isPending}
                        className={`text-sm text-gray-300 hover:text-white transition ${
                           isPending ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        onClick={() => {
                           if (!isPending) {
                              // TODO: Implement forgot password functionality
                              console.log("Forgot password clicked");
                           }
                        }}
                     >
                        Forgot password?
                     </button>
                  </div>

                  <div className="flex flex-col gap-2.5">
                     <Button
                        type="submit"
                        color="secondary"
                        disabled={isPending}
                        isLoading={isPending}
                        className="w-full"
                     >
                        {isPending ? "Creating account..." : "Sign up"}
                     </Button>

                     <button
                        type="button"
                        disabled={isPending}
                        className={`w-full text-white/80 py-2 bg-transparent cursor-pointer border border-gray-700 hover:border-gray-600 rounded-lg font-medium flex items-center justify-center gap-3 transition-all duration-200 ${
                           isPending ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        onClick={() => {
                           if (!isPending) {
                              // TODO: Implement Google Sign-In
                              console.log("Google sign-in clicked");
                           }
                        }}
                        aria-label="Sign in with Google"
                     >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
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
               <Link
                  className="text-white absolute bottom-0 left-0 px-2 py-3 flex gap-1 items-center hover:text-white/80 transition"
                  to={"/"}
                  aria-label="Go back to home"
               >
                  <AiFillBackward aria-hidden="true" />
                  Go back
               </Link>
            </div>
         </div>

         <div className="dark:bg-[#22262F] col-span-3 overflow-hidden relative z-10">
            <img
               src={bgimg}
               alt="Background decorative image"
               className="hidden lg:block absolute w-full h-full object-cover opacity-70 select-none cursor-default -z-50"
            />

            <div className="text-white hidden lg:block absolute -bottom-55 -right-3/12 w-4/5 rounded-4xl">
               <img src={dashboard} className="rounded-4xl border-2 border-white/10" alt="Dashboard preview" />
            </div>
         </div>
      </div>
   );
};
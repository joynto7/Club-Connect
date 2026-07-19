"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerUser, getApiErrorMessage } from "@/lib/auth";
import { Mail, Lock, User, Eye, EyeOff, Building2, GraduationCap } from "lucide-react";
import PasswordStrengthIndicator from "@/components/shared/PasswordStrengthIndicator";
import LogoIcon from "@/components/shared/LogoIcon";

const YEAR_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "Masters", "PhD", "Other"];

const registerSchema = z.object({
  name:            z.string().min(2, "Name must be at least 2 characters"),
  email:           z.string().email("Enter a valid email"),
  department:      z.string().optional(),
  year:            z.string().optional(),
  password:        z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");

  const mutation = useMutation({
    mutationFn: registerUser,
    onSuccess(data) {
      setServerMessage(data.message || "Registration successful! Please verify your email.");
      setApiError(null);
    },
    onError(error) {
      setApiError(getApiErrorMessage(error));
      setServerMessage(null);
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "", email: "", department: "", year: "", password: "", confirmPassword: "",
    },
  });

  // Watch password for strength indicator
  const watchedPassword = watch("password");

  const onSubmit = ({ name, email, password, department, year }: RegisterFormValues) => {
    mutation.mutate({ name, email, password, department: department || undefined, year: year || undefined });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4 sm:p-8">
      <div className="flex w-full max-w-300 bg-white rounded-4xl shadow-sm overflow-hidden min-h-187.5">
        
        {/* LEFT COLUMN - BRANDING & ILLUSTRATION */}
        <div className="hidden lg:flex w-1/2 bg-[#FCFAF5] flex-col relative p-12 border-r border-gray-100">
          {/* Logo */}
          <div className="flex items-center gap-4 mb-16 z-10">
            <div className="w-12 h-12 rounded-xl shadow-sm overflow-hidden">
              <LogoIcon size={48} />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight text-gray-900 tracking-wide">
                CLUB <br /> <span className="text-[#EBA814]">CONNECT</span>
              </h1>
              <p className="text-[10px] text-gray-500 mt-0.5">Connect. Collaborate. Create Impact.</p>
            </div>
          </div>

          {/* Hero Text */}
          <div className="z-10 max-w-md">
            <h2 className="text-4xl font-bold text-gray-900 leading-tight mb-6">
              Welcome to  <br />
               <span className="text-[#EBB02D]">Club Connect</span>
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm">
              <b>Your choice !! Your Club !! Your Voice !! </b>
              
            </p>
          </div>

        

          {/* Illustration Background */}
          <div className="absolute bottom-0 right-0 left-0 h-[75%] pointer-events-none z-0">
            {/* Gradient overlay to smoothly blend the image top edge into the background color */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#FDF9F1] via-[#FDF9F1]/60 to-transparent z-10" />
            <Image 
              src="/assets/images/bg1.png" 
              alt="Campus Background"
              fill
              className="object-cover object-bottom opacity-95"
              priority
            />
          </div>
        </div>

        {/* RIGHT COLUMN - FORM */}
        <div className="w-full lg:w-1/2 p-8 sm:p-14 lg:p-16 flex flex-col justify-center relative">
          
          {/* Decorative dots top right */}
          <div className="absolute top-8 right-8 grid grid-cols-4 gap-2 opacity-20">
            {[...Array(16)].map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#EBB02D]"></div>
            ))}
          </div>

          <div className="max-w-md w-full mx-auto">
            <h2 className="text-4xl font-bold text-gray-900 mb-2">
              Create <span className="text-[#EBB02D]">Account!</span>
            </h2>
            <p className="text-gray-500 mb-8 text-sm">Sign up to join Club Connect</p>

            {serverMessage && <div className="p-3 mb-6 bg-green-50 text-green-700 rounded-xl text-sm border border-green-100">{serverMessage}</div>}
            {apiError && <div className="p-3 mb-6 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">{apiError}</div>}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              
              {/* Full Name Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    {...register("name")}
                    placeholder="Enter your name"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none transition-colors focus:border-[#EBB02D] focus:ring-1 focus:ring-[#EBB02D]"
                  />
                </div>
                {errors.name && <span className="text-xs text-red-500 mt-1 block">{errors.name.message}</span>}
              </div>

              {/* Email Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    {...register("email")}
                    placeholder="Enter your email"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none transition-colors focus:border-[#EBB02D] focus:ring-1 focus:ring-[#EBB02D]"
                  />
                </div>
                {errors.email && <span className="text-xs text-red-500 mt-1 block">{errors.email.message}</span>}
              </div>

              {/* Department + Year */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      {...register("department")}
                      placeholder="e.g. CSE"
                      className="w-full pl-9 pr-3 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none transition-colors focus:border-[#EBB02D] focus:ring-1 focus:ring-[#EBB02D]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Year</label>
                  <div className="relative">
                    <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <select
                      {...register("year")}
                      className="w-full pl-9 pr-3 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none transition-colors focus:border-[#EBB02D] focus:ring-1 focus:ring-[#EBB02D]"
                    >
                      <option value="">Select</option>
                      {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type={showPassword ? "text" : "password"}
                    {...register("password")}
                    placeholder="Create a password"
                    className="w-full pl-10 pr-10 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none transition-colors focus:border-[#EBB02D] focus:ring-1 focus:ring-[#EBB02D]"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <PasswordStrengthIndicator password={watchedPassword} />
                {errors.password && <span className="text-xs text-red-500 mt-1 block">{errors.password.message}</span>}
              </div>

              {/* Confirm Password Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    {...register("confirmPassword")}
                    placeholder="Confirm your password"
                    className="w-full pl-10 pr-10 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none transition-colors focus:border-[#EBB02D] focus:ring-1 focus:ring-[#EBB02D]"
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.confirmPassword && <span className="text-xs text-red-500 mt-1 block">{errors.confirmPassword.message}</span>}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={mutation.isPending}
                className="w-full py-3 mt-4 bg-[#EBB02D] hover:bg-[#D9A020] text-white font-medium rounded-xl transition-all shadow-[0_4px_14px_0_rgba(235,176,45,0.39)] disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {mutation.isPending ? "Registering..." : "Sign Up"}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center my-8">
              <div className="flex-1 border-t border-gray-200"></div>
              <span className="px-4 text-sm text-gray-400">or</span>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>

            {/* Google Social Auth */}
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:5001"}/auth/google`}
              className="w-full py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-3 text-sm"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </a>

            <p className="text-center mt-8 text-sm text-gray-500">
              Already have an account? <Link href="/login" className="text-[#EBB02D] font-medium hover:underline">Login</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
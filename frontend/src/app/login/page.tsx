"use client";

import Link from "next/link";
import Image from "next/image";
import LogoIcon from "@/components/shared/LogoIcon";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginUser, login2FA, getApiErrorMessage, buildAuthState, type LoginResponse } from "@/lib/auth";
import { setAuthState } from "@/lib/tokenStorage";
import { Mail, Lock, Eye, EyeOff, Shield, LogIn, Smartphone } from "lucide-react";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [twoFACode, setTwoFACode] = useState("");

  const mutation = useMutation({
    mutationFn: loginUser,
    onSuccess(data) {
      if ("requires2FA" in data && data.requires2FA) {
        setTempToken(data.tempToken);
        setTwoFAStep(true);
        setApiError(null);
        return;
      }
      setAuthState(buildAuthState(data as LoginResponse));
      setApiError(null);
      toast.success("Welcome back!");
      router.push("/dashboard");
    },
    onError(error) {
      const msg = getApiErrorMessage(error);
      setApiError(msg);
      toast.error(msg);
    },
  });

  const twoFAMutation = useMutation({
    mutationFn: ({ tempToken, token }: { tempToken: string; token: string }) => login2FA(tempToken, token),
    onSuccess(data) {
      setAuthState(buildAuthState(data));
      setApiError(null);
      toast.success("Welcome back!");
      router.push("/dashboard");
    },
    onError(error) {
      const msg = getApiErrorMessage(error);
      setApiError(msg);
      toast.error(msg);
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    mutation.mutate(values);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4 sm:p-8 font-sans">
      <div className="flex w-full max-w-300 bg-white rounded-4xl shadow-sm overflow-hidden min-h-187.5">
        
        {/* LEFT COLUMN - BRANDING & ILLUSTRATION */}
        <div className="hidden lg:flex w-1/2 bg-[#FDF9F1] flex-col relative p-12 border-r border-gray-100 overflow-hidden">
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
          <div className="z-10 max-w-md mt-4">
            <h2 className="text-4xl font-bold text-gray-900 leading-[1.15] mb-6 tracking-tight">
              Empowering Clubs.<br />
              Enriching <span className="text-[#EBA814]">Campus Life.</span>
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm pr-12 font-medium">
              Club Connect is your one-stop platform to discover clubs, manage activities, and build a stronger campus community.
            </p>
          </div>

          {/* Floating Trust Badge */}
          <div className="absolute bottom-12 left-12 z-20 bg-white px-5 py-3.5 rounded-2xl shadow-md flex items-center gap-4">
            <div className="text-[#EBA814]">
              <Shield size={24} strokeWidth={2} />
            </div>
            <p className="text-sm font-semibold text-gray-800 leading-tight">
              Trusted by clubs.<br />
              <span className="text-[#EBA814]">Loved</span> by communities.
            </p>
          </div>

          {/* Decorative Elements - Birds & Background */}
          <div className="absolute top-1/3 right-1/4 w-4 h-4 text-[#EBA814] opacity-70">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c-2.5-1.5-6-2-9-1.5-3-.5-6.5 0-9 1.5 2.5-1.5 6-1 9 0 3-1 6.5-1.5 9 0z"/></svg>
          </div>
          <div className="absolute top-1/4 right-1/3 w-3 h-3 text-[#EBA814] opacity-50">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c-2.5-1.5-6-2-9-1.5-3-.5-6.5 0-9 1.5 2.5-1.5 6-1 9 0 3-1 6.5-1.5 9 0z"/></svg>
          </div>
          <div className="absolute top-[40%] right-10 w-5 h-5 text-[#EBA814] opacity-60">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c-2.5-1.5-6-2-9-1.5-3-.5-6.5 0-9 1.5 2.5-1.5 6-1 9 0 3-1 6.5-1.5 9 0z"/></svg>
          </div>

          {/* Illustration Background */}
          <div className="absolute bottom-0 right-0 left-0 h-[75%] pointer-events-none z-0">
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
        <div className="w-full lg:w-1/2 p-8 sm:p-14 lg:p-16 flex flex-col justify-center relative bg-white">
          
          {/* Decorative dots top right */}
          <div className="absolute top-10 right-10 grid grid-cols-5 gap-2 opacity-30">
            {[...Array(20)].map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#EBA814]"></div>
            ))}
          </div>

          <div className="max-w-md w-full mx-auto z-10">
            <h2 className="text-[2.5rem] font-bold text-gray-900 mb-2 tracking-tight">
              Welcome <span className="text-[#EBA814]">Back!</span>
            </h2>
            <p className="text-gray-500 mb-10 text-base font-medium">Login to continue to Club Connect</p>

            {apiError && <div className="p-3 mb-6 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">{apiError}</div>}

            {/* 2FA Step */}
            {twoFAStep ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <Smartphone size={20} className="text-[#EBA814] flex-shrink-0" />
                  <p className="text-sm text-amber-800 font-medium">Enter the 6-digit code from your authenticator app</p>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={twoFACode}
                  onChange={e => setTwoFACode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="w-full text-center text-3xl tracking-[0.6em] font-mono border-2 border-gray-200 rounded-xl py-4 bg-white focus:outline-none focus:border-[#EBA814]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => twoFAMutation.mutate({ tempToken, token: twoFACode })}
                  disabled={twoFACode.length < 6 || twoFAMutation.isPending}
                  className="w-full py-3.5 bg-[#EBA814] hover:bg-[#D99810] text-white font-semibold rounded-xl transition-all shadow-[0_6px_20px_rgba(235,168,20,0.3)] disabled:opacity-70 flex items-center justify-center gap-2 text-base"
                >
                  <LogIn size={20} strokeWidth={2} className="opacity-90" />
                  {twoFAMutation.isPending ? "Verifying…" : "Verify & Login"}
                </button>
                <button type="button" onClick={() => { setTwoFAStep(false); setTwoFACode(""); setTempToken(""); }} className="w-full text-sm text-gray-500 hover:text-gray-700">
                  Back to login
                </button>
              </div>
            ) : (
            <>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Email Input */}
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} strokeWidth={1.5} />
                  <input
                    {...register("email")}
                    placeholder="Enter your email"
                    className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm outline-none transition-colors focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814] placeholder:text-gray-400 font-medium"
                  />
                </div>
                {errors.email && <span className="text-xs text-red-500 mt-1.5 block font-medium">{errors.email.message}</span>}
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-bold text-gray-800">Password</label>
                  <Link href="/forgot-password" className="text-xs font-semibold text-[#EBA814] hover:underline">
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} strokeWidth={1.5} />
                  <input
                    type={showPassword ? "text" : "password"}
                    {...register("password")}
                    placeholder="Enter your password"
                    className="w-full pl-12 pr-12 py-3.5 bg-white border border-gray-200 rounded-xl text-sm outline-none transition-colors focus:border-[#EBA814] focus:ring-1 focus:ring-[#EBA814] placeholder:text-gray-400 font-medium"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPassword ? <EyeOff size={20} strokeWidth={1.5} /> : <Eye size={20} strokeWidth={1.5} />}
                  </button>
                </div>
                {errors.password && <span className="text-xs text-red-500 mt-1.5 block font-medium">{errors.password.message}</span>}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={mutation.isPending}
                className="w-full py-3.5 mt-8 bg-[#EBA814] hover:bg-[#D99810] text-white font-semibold rounded-xl transition-all shadow-[0_6px_20px_rgba(235,168,20,0.3)] disabled:opacity-70 flex items-center justify-center gap-2 text-base"
              >
                <LogIn size={20} strokeWidth={2} className="opacity-90" />
                {mutation.isPending ? "Logging in..." : "Login"}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center my-8">
              <div className="flex-1 border-t border-gray-200"></div>
              <span className="px-5 text-sm font-medium text-gray-400">or</span>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>

            {/* Google Social Auth */}
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:5001"}/auth/google`}
              className="w-full py-3.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-3 text-sm shadow-sm"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </a>

            <p className="text-center mt-8 text-sm font-medium text-gray-500">
              Don't have an account? <Link href="/register" className="text-[#EBA814] font-bold hover:underline">Sign Up</Link>
            </p>
            </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

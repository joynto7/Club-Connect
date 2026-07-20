"use client";

import Link from "next/link";
import LogoIcon from "@/components/shared/LogoIcon";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  loginUser, login2FA, getApiErrorMessage, buildAuthState, type LoginResponse,
  resendVerification, changeUnverifiedEmail,
} from "@/lib/auth";
import { setAuthState } from "@/lib/tokenStorage";
import { Mail, Lock, Eye, EyeOff, LogIn, Smartphone } from "lucide-react";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// Mirrors the exact string backend/src/controllers/authController.ts's login
// handler returns for an unverified account. No shared package between the
// two apps to enforce this — kept in sync by hand.
const EMAIL_NOT_VERIFIED_MESSAGE = "Please verify your email before logging in.";

export default function LoginPage() {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [twoFACode, setTwoFACode] = useState("");
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");

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

  const resendMutation = useMutation({
    mutationFn: resendVerification,
    onSuccess(data) {
      toast.success(data.message);
    },
    onError(error) {
      toast.error(getApiErrorMessage(error));
    },
  });

  const changeEmailMutation = useMutation({
    mutationFn: changeUnverifiedEmail,
    onSuccess(data) {
      toast.success(data.message);
      setApiError(null);
      setShowChangeEmail(false);
      setNewEmail("");
    },
    onError(error) {
      toast.error(getApiErrorMessage(error));
    },
  });

  const {
    register,
    handleSubmit,
    getValues,
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
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-100 p-8 sm:p-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl shadow-sm overflow-hidden mb-3">
            <LogoIcon size={56} />
          </div>
          <h1 className="text-lg font-bold text-gray-900 tracking-wide">
            CLUB <span className="text-[#EBA814]">CONNECT</span>
          </h1>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-1 text-center">
          Welcome <span className="text-[#EBA814]">Back!</span>
        </h2>
        <p className="text-gray-500 mb-8 text-sm text-center font-medium">Login to continue to Club Connect</p>

        {apiError && <div className="p-3 mb-6 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">{apiError}</div>}

        {apiError === EMAIL_NOT_VERIFIED_MESSAGE && (
          <div className="p-4 mb-6 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
            <button
              type="button"
              onClick={() => resendMutation.mutate({ email: getValues("email") })}
              disabled={resendMutation.isPending}
              className="text-sm font-semibold text-[#EBA814] hover:underline disabled:opacity-60"
            >
              {resendMutation.isPending ? "Sending…" : "Resend verification email"}
            </button>

            <div>
              <button
                type="button"
                onClick={() => setShowChangeEmail((v) => !v)}
                className="text-sm font-semibold text-[#EBA814] hover:underline"
              >
                Wrong email? Change it
              </button>
              {showChangeEmail && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Corrected email address"
                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#EBA814]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      changeEmailMutation.mutate({
                        email: getValues("email"),
                        password: getValues("password"),
                        newEmail,
                      })
                    }
                    disabled={changeEmailMutation.isPending || !z.string().email().safeParse(newEmail).success}
                    className="px-4 py-2 bg-[#EBA814] hover:bg-[#D99810] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                  >
                    {changeEmailMutation.isPending ? "Updating…" : "Update"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

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
                className="w-full py-3.5 mt-2 bg-[#EBA814] hover:bg-[#D99810] text-white font-semibold rounded-xl transition-all shadow-[0_6px_20px_rgba(235,168,20,0.3)] disabled:opacity-70 flex items-center justify-center gap-2 text-base"
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
  );
}

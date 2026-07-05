"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPassword, getApiErrorMessage } from "@/lib/auth";

const resetPasswordSchema = z
  .object({
    token: z.string().min(10, "Reset token is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordForm({ token }: { token: string }) {
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: resetPassword,
    onSuccess(data) {
      setServerMessage(data.message || "Password reset successfully. You may now sign in.");
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
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token,
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = ({ token: submittedToken, password }: ResetPasswordFormValues) => {
    mutation.mutate({ token: submittedToken, password });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface py-16 px-4 text-text-primary">
      <div className="w-full max-w-lg rounded-[var(--radius-lg)] border border-border bg-surface-strong p-10 shadow-[var(--shadow-md)]">
        <h1 className="text-3xl font-semibold">Reset your password</h1>
        <p className="mt-2 text-text-secondary">
          Enter your new password below. Paste the reset token from your email if it is not already present in the URL.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <label className="block">
            <span className="text-sm font-medium text-text-secondary">Reset token</span>
            <input
              type="text"
              {...register("token")}
              className="mt-2 w-full rounded-[var(--radius-sm)] border border-border bg-white px-4 py-3 text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {errors.token && <p className="mt-2 text-sm text-danger">{errors.token.message}</p>}
          </label>

          <label className="block">
            <span className="text-sm font-medium text-text-secondary">New password</span>
            <input
              type="password"
              {...register("password")}
              className="mt-2 w-full rounded-[var(--radius-sm)] border border-border bg-white px-4 py-3 text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {errors.password && <p className="mt-2 text-sm text-danger">{errors.password.message}</p>}
          </label>

          <label className="block">
            <span className="text-sm font-medium text-text-secondary">Confirm new password</span>
            <input
              type="password"
              {...register("confirmPassword")}
              className="mt-2 w-full rounded-[var(--radius-sm)] border border-border bg-white px-4 py-3 text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {errors.confirmPassword && (
              <p className="mt-2 text-sm text-danger">{errors.confirmPassword.message}</p>
            )}
          </label>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-70"
          >
            {mutation.isPending ? "Resetting password..." : "Reset password"}
          </button>
        </form>

        {apiError && <p className="mt-4 text-sm text-danger">{apiError}</p>}
        {serverMessage && <p className="mt-4 text-sm text-success">{serverMessage}</p>}

        <div className="mt-6 flex flex-col gap-3 text-sm text-text-secondary">
          <Link href="/login" className="text-primary hover:underline">
            Back to login
          </Link>
          <Link href="/forgot-password" className="text-accent hover:underline">
            Send another reset link
          </Link>
        </div>
      </div>
    </main>
  );
}

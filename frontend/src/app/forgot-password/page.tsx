"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { requestPasswordReset, getApiErrorMessage } from "@/lib/auth";

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: requestPasswordReset,
    onSuccess(data) {
      setServerMessage(data.message || "If that email is registered, you will receive instructions soon.");
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
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = ({ email }: ForgotPasswordFormValues) => {
    mutation.mutate({ email });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface py-16 px-4 text-text-primary">
      <div className="w-full max-w-lg rounded-[var(--radius-lg)] border border-border bg-surface-strong p-10 shadow-[var(--shadow-md)]">
        <h1 className="text-3xl font-semibold">Reset your password</h1>
        <p className="mt-2 text-text-secondary">
          Enter the email address associated with your account, and we’ll send you a password reset link.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <label className="block">
            <span className="text-sm font-medium text-text-secondary">Email</span>
            <input
              type="email"
              {...register("email")}
              className="mt-2 w-full rounded-[var(--radius-sm)] border border-border bg-white px-4 py-3 text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {errors.email && <p className="mt-2 text-sm text-danger">{errors.email.message}</p>}
          </label>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-70"
          >
            {mutation.isPending ? "Sending reset email..." : "Send reset link"}
          </button>
        </form>

        {apiError && <p className="mt-4 text-sm text-danger">{apiError}</p>}
        {serverMessage && <p className="mt-4 text-sm text-success">{serverMessage}</p>}

        <div className="mt-6 flex flex-col gap-3 text-sm text-text-secondary">
          <Link href="/login" className="text-primary hover:underline">
            Back to login
          </Link>
          <Link href="/register" className="text-accent hover:underline">
            Create a new account
          </Link>
        </div>
      </div>
    </main>
  );
}

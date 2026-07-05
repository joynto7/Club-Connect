"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/axios";
import { getApiErrorMessage } from "@/lib/auth";

export default function VerifyEmail() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrorMessage("Verification token is required.");
      return;
    }

    const verify = async () => {
      setIsLoading(true);
      try {
        const response = await api.get<{ message: string }>("/auth/verify-email", {
          params: { token },
        });
        setStatusMessage(response.data.message ?? "Email verified successfully.");
        setErrorMessage(null);
      } catch (error) {
        setErrorMessage(getApiErrorMessage(error));
        setStatusMessage(null);
      } finally {
        setIsLoading(false);
      }
    };

    verify();
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface py-16 px-4 text-text-primary">
      <div className="w-full max-w-lg rounded-[var(--radius-lg)] border border-border bg-surface-strong p-10 shadow-[var(--shadow-md)]">
        <h1 className="text-3xl font-semibold">Verify your email</h1>
        <p className="mt-2 text-text-secondary">
          {isLoading
            ? "Verifying your email..."
            : "We are confirming your email address. Please wait."}
        </p>

        {errorMessage && <p className="mt-6 text-sm text-danger">{errorMessage}</p>}
        {statusMessage && <p className="mt-6 text-sm text-success">{statusMessage}</p>}
      </div>
    </main>
  );
}

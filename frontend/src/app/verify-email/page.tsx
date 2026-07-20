import { Suspense } from "react";
import VerifyEmail from "@/components/auth/VerifyEmail";

export const dynamic = "force-dynamic";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading…</div>}>
      <VerifyEmail />
    </Suspense>
  );
}

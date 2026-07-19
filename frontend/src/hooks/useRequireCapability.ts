"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuthState } from "@/lib/tokenStorage";
import { hasCapability, type Capability } from "@/lib/permissions";

export function useRequireCapability(capability: Capability) {
  const router = useRouter();

  useEffect(() => {
    const auth = getAuthState();
    if (!auth || !hasCapability(auth.user.role, capability)) {
      router.replace("/dashboard");
    }
  }, [capability, router]);
}

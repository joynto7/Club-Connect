"use client";

import { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/auth";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 1000 * 60 * 2,
    },
    mutations: {
      onError: (err) => {
        toast.error(getApiErrorMessage(err));
      },
    },
  },
});

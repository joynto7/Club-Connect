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
      // A mutation's own onError fully replaces this default (not both firing) —
      // define onError: () => {} on a specific mutation to opt out of the toast.
      onError: (err) => {
        toast.error(getApiErrorMessage(err));
      },
    },
  },
});

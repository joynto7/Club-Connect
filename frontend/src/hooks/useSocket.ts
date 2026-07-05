"use client";

import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { getAuthState } from "@/lib/tokenStorage";

export function useSocket(): Socket {
  const socketRef = useRef<Socket | null>(null);

  if (!socketRef.current) {
    const token = getAuthState()?.tokens.accessToken ?? "";
    socketRef.current = getSocket(token);
  }

  return socketRef.current;
}

export function useSocketDisconnect(): void {
  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);
}

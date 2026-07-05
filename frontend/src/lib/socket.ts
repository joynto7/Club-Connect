"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(token: string): Socket {
  if (!socket || !socket.connected) {
    socket?.disconnect();
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://127.0.0.1:5001", {
      auth: { token },
      transports: ["websocket"],
      autoConnect: true,
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

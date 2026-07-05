import { io } from "../index.ts";

export function emitToUser(userId: string, event: string, data: unknown): void {
  io.to(`user:${userId}`).emit(event, data);
}

export function emitToEvent(eventId: string, event: string, data: unknown): void {
  io.to(`event:${eventId}`).emit(event, data);
}

export function emitToAdmin(event: string, data: unknown): void {
  io.to("admin").emit(event, data);
}

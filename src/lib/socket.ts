"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({ transports: ["websocket", "polling"], autoConnect: false });
  }
  return socket;
}

export function getParticipantId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("s2v-participant-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("s2v-participant-id", id);
  }
  return id;
}

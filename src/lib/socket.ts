"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL ?? "";
    console.log("[socket] connecting to:", url || "(same origin)");
    socket = io(url, { transports: ["websocket", "polling"], autoConnect: false });
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

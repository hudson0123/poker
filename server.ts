import { createServer } from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { SessionStore } from "./src/server/SessionStore";
import { registerSocketHandlers } from "./src/server/socketHandlers";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handle);

  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
    transports: ["websocket", "polling"],
  });

  const store = new SessionStore();
  registerSocketHandlers(io, store);

  // Cleanup stale sessions every 5 minutes
  setInterval(() => {
    const removed = store.cleanupStaleSessions();
    if (removed > 0) {
      console.log(`Cleaned up ${removed} stale session(s)`);
    }
  }, 5 * 60 * 1000);

  httpServer.listen(port, () => {
    console.log(`> S2V Poker ready on http://${hostname}:${port}`);
  });
});

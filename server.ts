import { createServer } from "http";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handle);
  httpServer.listen(port, () => {
    console.log(`> S2V Poker ready on http://${hostname}:${port}`);
  });
});

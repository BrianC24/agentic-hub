/**
 * Fails loudly when something is already serving on the port.
 *
 * A stale `next start` once held port 3000 through a whole verification pass,
 * so checks that looked like they were testing new code were reading an old
 * build. Next.js does print a warning, but it scrolls past when output is
 * backgrounded to a log — this refuses to start instead.
 *
 * Attempts a connection rather than a bind: Next listens dual-stack, and a
 * bind test on 127.0.0.1 succeeds alongside it, which is exactly how the
 * first version of this check silently passed while the port was occupied.
 */
import { connect } from "node:net";

const PORT = Number(process.env.PORT ?? 3000);
const TIMEOUT_MS = 1000;

const socket = connect({ port: PORT, host: "127.0.0.1" });

socket.setTimeout(TIMEOUT_MS);

socket.once("connect", () => {
  socket.destroy();
  console.error(
    `\nPort ${PORT} is already serving — another instance is running.\n` +
      `Anything you test now would hit that server, not this build.\n\n` +
      `  lsof -ti:${PORT} | xargs kill\n`,
  );
  process.exit(1);
});

// Nothing listening, or it did not answer in time: safe to start.
socket.once("error", () => {
  socket.destroy();
  process.exit(0);
});

socket.once("timeout", () => {
  socket.destroy();
  process.exit(0);
});

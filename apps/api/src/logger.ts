import type { Context, Next } from "hono";

/**
 * Colors for a terminal only (the Node.js server run by hand): Workers Logs, Docker
 * and journald would show the escape codes as they are.
 */
const colors = (globalThis as { process?: { stdout?: { isTTY?: boolean } } })
  .process?.stdout?.isTTY === true;

/** One line per request: `GET /entry/logos 200 - 12ms`. */
export const logger = () => async (c: Context, next: Next) => {
  const start = Date.now();
  await next();

  const decodedPath = decodeURIComponent(c.req.path);
  const status = c.res.status;
  const duration = Date.now() - start;
  const method = c.req.method;

  const colorize = (value: string, color: string, bold = false) =>
    colors ? `\x1b[${bold ? "1;" : ""}${color}m${value}\x1b[0m` : value;
  const statusColor = status >= 500
    ? "31"
    : status >= 400
    ? "33"
    : status >= 300
    ? "36"
    : "32";
  const methodColor = method === "GET" ? "34" : method === "POST" ? "35" : "33";

  console.info(
    `${colorize(method, methodColor, true)} ${decodedPath} ${
      colorize(String(status), statusColor, true)
    } - ${colorize(`${duration}ms`, "90")}`
  );
};

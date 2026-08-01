import type { Context, Next } from "@hono/hono";

export const logger = () => async (c: Context, next: Next) => {
  const start = Date.now();
  await next();

  const decodedPath = decodeURIComponent(c.req.path);
  const status = c.res.status;
  const duration = Date.now() - start;
  const method = c.req.method;

  const colorize = (value: string, color: string, bold = false) =>
    `\x1b[${bold ? "1;" : ""}${color}m${value}\x1b[0m`;
  const statusColor =
    status >= 500 ? "31" : status >= 400 ? "33" : status >= 300 ? "36" : "32";
  const methodColor = method === "GET" ? "34" : method === "POST" ? "35" : "33";

  console.info(
    `${colorize(method, methodColor, true)} ${decodedPath} ${colorize(String(status), statusColor, true)} - ${colorize(`${duration}ms`, "90")}`
  );
};

import type { H3Event } from "h3";
import { getRequestURL, getResponseStatus } from "h3";
import { requestLogLine, type RequestCf } from "../lib/requestLog";

/**
 * Logs the requests kept (cf. `server/lib/requestLog.ts`), on Cloudflare
 * only: there, the request's `cf` object is in the event's context (none for
 * Nuxt's own subrequests, as the error page's, nor under Node). An object
 * rather than a text, so that Workers Logs indexes its fields.
 *
 * A request ends either by a response (`afterResponse`), or by an error the
 * error handler answers (`error`, without `afterResponse`); logged once.
 */
export default defineNitroPlugin((nitroApp) => {
  const log = (event: H3Event, status: number) => {
    const cf = event.context.cf as RequestCf | undefined;
    if (!cf || event.context.requestLogged) return;
    event.context.requestLogged = true;

    const line = requestLogLine({
      method: event.method,
      path: getRequestURL(event).pathname,
      status,
      headers: event.headers,
      cf,
    }, Math.random());
    if (line) console.log(line);
  };

  nitroApp.hooks.hook("afterResponse", (event) => {
    log(event, getResponseStatus(event));
  });

  nitroApp.hooks.hook("error", (error, { event }) => {
    if (!event) return;
    const { status, statusCode } = error as { status?: number; statusCode?: number };
    log(event, status ?? statusCode ?? 500);
  });
});

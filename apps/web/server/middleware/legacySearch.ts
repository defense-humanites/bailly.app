import { getRequestURL } from "h3";
import { legacySearchForm } from "../lib/legacySearch";

/**
 * Redirects the former search links (`/q=<Greek form>`, e.g. from gaffiot.fr)
 * to the entry of the form, or to the form's page if several entries match
 * (cf. `redirectToForm`).
 */
export default defineEventHandler(async (event) => {
  const form = legacySearchForm(getRequestURL(event).pathname);
  if (form === undefined) return;
  if (form === null) throw formNotFound(null);
  return redirectToForm(event, form);
});

import { getQuery, sendRedirect } from "h3";
import { searchSubmissionForm } from "../lib/searchSubmission";

/**
 * The search bar's form, submitted before the page is interactive (cf.
 * `searchSubmissionForm`): to the entry of the form, or to the form's page;
 * an empty search, back to the home page.
 */
export default defineEventHandler(async (event) => {
  const { q, mode } = getQuery(event);
  const form = searchSubmissionForm(q, mode);
  if (form === undefined) return sendRedirect(event, "/", 302);
  if (form === null) throw formNotFound(typeof q === "string" ? q.trim().slice(0, 50) : null);
  return redirectToForm(event, form);
});

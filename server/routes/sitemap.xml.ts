import { FEATURES } from "#shared/utils/features";
import { SITE_URL } from "#shared/utils/site";

/**
 * The site map (`/sitemap.xml`, cf. `robots.txt`): the fixed pages, the
 * news while they are offered (cf. `FEATURES`). Not the entries: the search
 * engines reach them by the links (one list of them all would need every
 * address, from the API). Prerendered (cf. `nuxt.config.ts`): a static file.
 */
export default defineEventHandler((event) => {
  const pages = [
    "/",
    "/à-propos",
    ...(FEATURES.news ? ["/nouveautés"] : []),
    "/signets",
    "/préférences",
    "/confidentialité",
  ];
  setResponseHeader(event, "content-type", "application/xml; charset=utf-8");
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">",
    ...pages.map(path => `  <url><loc>${SITE_URL}${encodeURI(path)}</loc></url>`),
    "</urlset>",
    "",
  ].join("\n");
});

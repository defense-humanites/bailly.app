/**
 * Parts of the application not offered yet, turned on later (cf. the
 * publication, 4 October 2026): the news (rewritten on 5 October, with a link
 * to a survey on the features to come), the donations (some weeks after the
 * publication), and the about page's closing section (« Un dictionnaire
 * libre, porté par une association », to be reworked). Off, their links are
 * hidden and their pages not served (`/nouveautés`, `/soutenir/*`, cf. the
 * `pages:extend` hook of `nuxt.config.ts`: their addresses lead to the error
 * page). Their tests are skipped meanwhile.
 */
export const FEATURES: { news: boolean; donations: boolean; aboutClosing: boolean } = {
  news: true,
  donations: false,
  aboutClosing: false,
};

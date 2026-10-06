/**
 * The register of the notices a user can dismiss (cf. `useDismissed`): their
 * ids are kept in the local storage (`bailly:dismissed`) and synchronized
 * with the preferences, so that a notice dismissed is so on every device.
 * An id once published belongs to its notice for good: never reuse one for
 * another notice (it would arrive dismissed), retire it instead.
 */
export const NOTICES = {
  /** The search bar's warning about the morphological results (`SearchBar`). */
  morpheusWarning: "Résultats de l'analyse morphologique",
  /**
   * The bookmarks page's former single introduction (until 5 October 2026),
   * retired: dismissed, it dismisses both cards of the guide.
   */
  bookmarksIntro: "Présentation des signets (ancienne)",
  /** The bookmarks guide's card « Organiser vos entrées » (`signets.vue`). */
  bookmarksGuide: "Organiser vos entrées",
  /** The bookmarks guide's card « Conserver vos signets » (`signets.vue`). */
  bookmarksKeep: "Conserver vos signets",
  /**
   * The installed application's own data on iOS, on the bookmarks and
   * preferences pages (`InstalledOnIosNotice`).
   */
  installedOnIos: "Application installée : des données à part",
} as const;

export type NoticeId = keyof typeof NOTICES;

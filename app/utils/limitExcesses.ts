import type { BookmarksLimits, LimitExcess } from "~/idb/merge";

/**
 * Explains the limits that bookmarks brought together would exceed, and what
 * to remove on this device: among what only it brings, which always suffices
 * (cf. `LimitExcess.local`).
 * @param lead What would exceed them, e.g. « Réunis avec ceux de vos autres
 * appareils, vos signets dépasseraient les limites. ».
 * @param ending What happens next, e.g. « Réessayez ensuite. ».
 */
export function describeLimitExcesses(
  excesses: LimitExcess[],
  { maxTags, tagMaxItems }: BookmarksLimits,
  { lead, ending }: { lead: string; ending: string },
): string {
  const among = (names: string[]): string => {
    const shown = names.slice(0, 5).map(name => `« ${name} »`).join(", ");
    return names.length ? ` parmi celles qui ne sont que sur cet appareil (${shown}${names.length > 5 ? "…" : ""})` : "";
  };
  const parts = excesses.slice(0, 3).map((excess) => {
    if (excess.kind === "tags") {
      return `vous auriez ${excess.count} étiquettes (${maxTags} au plus) : supprimez-en au moins ${excess.count - maxTags}${among(excess.local)}`;
    }
    const over = excess.count - tagMaxItems;
    return excess.tag === null
      ? `les favoris compteraient ${excess.count} entrées (${tagMaxItems} au plus) : retirez-en au moins ${over}${among(excess.local)}`
      : `l'étiquette « ${excess.tag} » compterait ${excess.count} entrées (${tagMaxItems} au plus) : retirez-en au moins ${over}${among(excess.local)}`;
  });
  if (excesses.length > parts.length) parts.push("d'autres limites sont aussi dépassées");
  return `${lead} Sur cet appareil, ${parts.join(" ; ")}. ${ending}`;
}

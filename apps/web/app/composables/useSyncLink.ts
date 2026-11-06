import { fromBase64url } from "~/sync/base64url";

/**
 * The key of a link (`/signets#sync=…`, `/préférences#sync=…`), to join the
 * synchronization: read when the page loads or when its fragment changes (a
 * link opened in the same tab), then removed from the address (history,
 * shared links).
 * @param onKey Called with the key (an invalid link is ignored).
 */
export const useSyncLink = (onKey: (secret: Uint8Array<ArrayBuffer>) => void): void => {
  const route = useRoute();

  const readLink = (hash: string): void => {
    const match = /^#sync=([\w-]{22})$/.exec(hash);
    if (!match) return;
    try {
      onKey(fromBase64url(match[1]!));
    } catch {
      // An invalid link: ignored.
    }
    void navigateTo({ hash: "" }, { replace: true });
  };

  onMounted(() => {
    readLink(route.hash);
  });
  watch(() => route.hash, readLink);
};

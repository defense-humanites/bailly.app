<script setup lang="ts">
  import type { SyncScope } from "~/utils/syncHint";

  const props = defineProps<{
    /** The page: the bookmarks', or the preferences' (both types of data). */
    page: "bookmarks" | "preferences";
  }>();

  const emit = defineEmits<{
    /** « Synchroniser »: the window of the type of data to synchronize. */
    synchronize: [scope: SyncScope];
  }>();

  /**
   * Installed on an iPhone or iPad's home screen, the application keeps its
   * own storage, apart from Safari's (cf. `useInstalledOnIos`): told on the
   * bookmarks and preferences pages while their data aren't synchronized,
   * until dismissed (on both pages at once).
   */
  const installedOnIos = useInstalledOnIos();
  const dismissed = useDismissed("installedOnIos");

  // Whether a type is synchronized: as the cookie tells until the settings
  // are loaded (cf. `SyncButton`).
  const syncStore = useSyncStore();
  const { loaded, syncedBookmarks, syncedPreferences } = storeToRefs(syncStore);
  const hint = useCookie<unknown>(SYNC_HINT_COOKIE, { ...syncHintCookieOptions, readonly: true });
  const synced = (scope: SyncScope): boolean => {
    if (!loaded.value) return parseSyncHint(hint.value).includes(scope);
    return scope === "bookmarks" ? syncedBookmarks.value : syncedPreferences.value.length > 0;
  };

  /** The types of data of the page not synchronized yet. */
  const unsynced = computed((): SyncScope[] =>
    (props.page === "bookmarks" ? ["bookmarks"] as const : ["preferences", "bookmarks"] as const).filter(scope => !synced(scope)));

  const shown = computed((): boolean => installedOnIos.value && !dismissed.value && unsynced.value.length > 0);
</script>

<!--
  A notice: a limitation of iOS (not of Bailly.app), the way round it (the
  synchronization, the key's words typed, the QR code opening in Safari).
  The same text on both pages (the bookmarks and the preferences): dismissed
  on one, it is so on the other.
-->
<template>
  <UAlert
    v-if="shown"
    icon="i-lucide-tablet-smartphone"
    color="warning"
    variant="soft"
    title="Application installée : des données à part"
    description="Sur iPhone et iPad, iOS isole l'application ajoutée à l'écran d'accueil de Safari : elle n'a pas accès aux signets ni aux préférences enregistrés dans Safari. Pour les y retrouver, synchronisez-les ; le QR code s'ouvrant dans Safari, saisissez dans l'application les douze mots de votre clé."
    :ui="{ description: 'text-default opacity-100' }"
    :actions="[{ label: 'Synchroniser', icon: 'i-lucide-cloud-upload', color: 'secondary', variant: 'solid', onClick: () => emit('synchronize', unsynced[0]!) }]"
    close
    @update:open="dismissed = true"
  />
</template>

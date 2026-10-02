<script setup lang="ts">
  import { DEFAULT_SYNCED_PREFERENCES, SYNCABLE_PREFERENCES } from "~/utils/preferences";

  /**
   * The synchronization on the preferences page: a switch per type of data
   * (the bookmarks, the preferences), then, once one is on, its state, a
   * synchronization at once and the key. The window (`SyncDialog`) does the
   * rest: enabling (a key created, or one typed), stopping, the preferences
   * chosen; it also opens from a link (`/préférences#sync=…`).
   */

  const props = defineProps<{
    /** The `cardUi` of the preferences page. */
    ui: Record<string, string>;
  }>();

  /**
   * A light Aegean blue (on the page's card background, so as opaque), as
   * the button of the bookmarks page (`secondary`): told apart from the
   * settings.
   */
  const ui = computed(() => ({
    ...props.ui,
    root: "bg-[color-mix(in_oklab,var(--ui-bg)_90%,var(--ui-color-secondary-500))] ring-(--ui-color-secondary-200) divide-secondary/20 dark:bg-[color-mix(in_oklab,var(--ui-bg)_88%,var(--ui-color-secondary-500))] dark:ring-(--ui-color-secondary-900)",
    body: `${props.ui.body ?? ""} divide-secondary/20`,
  }));

  const syncStore = useSyncStore();
  const { loaded, enabled, syncedBookmarks, syncedPreferences, status, error, errorNeedsAction, errorSection } = storeToRefs(syncStore);
  const toast = useToast();

  /**
   * Until the settings are loaded (on the server, and a moment once
   * hydrated), the types synchronized as a cookie tells (cf.
   * `utils/syncHint.ts`): the right switches show at once.
   */
  const hint = useCookie<unknown>(SYNC_HINT_COOKIE, { ...syncHintCookieOptions, readonly: true });
  const hinted = parseSyncHint(hint.value);

  const bookmarksOn = computed(() => (loaded.value ? syncedBookmarks.value : hinted.includes("bookmarks")));
  const preferencesOn = computed(() => (loaded.value ? syncedPreferences.value.length > 0 : hinted.includes("preferences")));

  /**
   * The type of data the key and the state concern first.
   */
  const mainScope = computed((): SyncScope => (preferencesOn.value || !bookmarksOn.value ? "preferences" : "bookmarks"));

  /**
   * Whether the latest synchronization failed (e.g. the limits would be
   * exceeded: the user has to make room).
   */
  const needsAttention = computed(() => enabled.value && status.value === "error" && Boolean(error.value));

  const { lastSync, syncingShown, manualSync, syncNow } = useSyncActivity();

  /* The window. */

  const isOpen = ref(false);
  const requested = ref(false);
  const dialogScope = ref<SyncScope>("preferences");
  const startView = ref<"status" | "stop" | "key">();
  const linkSecret = ref<Uint8Array<ArrayBuffer> | null>(null);

  watch(isOpen, (value) => {
    if (value) requested.value = true;
  });

  const openDialog = (scope: SyncScope, view?: "status" | "stop" | "key"): void => {
    // The key of a link only counts when the link is opened.
    linkSecret.value = null;
    dialogScope.value = scope;
    startView.value = view;
    isOpen.value = true;
  };

  useSyncLink((secret) => {
    linkSecret.value = secret;
    dialogScope.value = "preferences";
    startView.value = undefined;
    isOpen.value = true;
  });

  /* The switches. */

  const busy = ref<SyncScope | null>(null);

  /**
   * Switching a type on: with a key already, added at once; otherwise, the
   * window offers to create a key or to type one. Switching it off: the
   * window asks whether on this device only, or everywhere.
   */
  const toggle = async (scope: SyncScope, on: boolean): Promise<void> => {
    if (!loaded.value || busy.value) return;
    if (!on) {
      openDialog(scope, "stop");
      return;
    }
    if (!enabled.value) {
      openDialog(scope);
      return;
    }
    busy.value = scope;
    try {
      const result = await syncStore.setSections(scope === "bookmarks"
        ? { bookmarks: true, preferences: [...syncedPreferences.value] }
        : { bookmarks: syncedBookmarks.value, preferences: [...DEFAULT_SYNCED_PREFERENCES] });
      if (result.state === "error") {
        toast.add({ title: result.message, icon: "i-lucide-circle-alert", color: "error" });
        return;
      }
      toast.add({
        title: scope === "bookmarks" ? "Synchronisation des signets activée" : "Synchronisation des préférences activée",
        icon: "i-lucide-circle-check",
        color: "success",
      });
    } finally {
      busy.value = null;
    }
  };

  /**
   * The preferences synchronized, e.g. « 4 sur 8 » (once loaded).
   */
  const preferencesCount = computed(() => (loaded.value ? `${syncedPreferences.value.length} sur ${SYNCABLE_PREFERENCES.length}, marquées` : "Marquées"));
</script>

<template>
  <UCard
    as="section"
    aria-labelledby="settings-sync"
    :ui="ui"
  >
    <template #header>
      <h2
        id="settings-sync"
        class="flex items-center gap-2 text-lg font-semibold"
      >
        <UIcon
          name="i-lucide-cloud"
          class="size-5 shrink-0 text-secondary"
        />
        Synchronisation
      </h2>
    </template>

    <SettingsRow
      label="Signets"
      description="Étiquettes, entrées et épingles."
    >
      <USwitch
        color="secondary"
        :model-value="bookmarksOn"
        :loading="busy === 'bookmarks'"
        aria-label="Synchroniser les signets"
        @update:model-value="(value) => toggle('bookmarks', value)"
      />
    </SettingsRow>
    <SettingsRow label="Préférences">
      <template #description>
        <template v-if="preferencesOn">
          {{ preferencesCount }} d'un nuage ·
          <button
            type="button"
            class="font-medium text-default underline decoration-dotted underline-offset-3 hover:text-highlighted focus-visible:outline-2 focus-visible:outline-inverted"
            aria-haspopup="dialog"
            @click="openDialog('preferences')"
          >
            Choisir
          </button>
        </template>
        <template v-else>
          Celles de votre choix.
        </template>
      </template>
      <USwitch
        color="secondary"
        :model-value="preferencesOn"
        :loading="busy === 'preferences'"
        aria-label="Synchroniser les préférences"
        @update:model-value="(value) => toggle('preferences', value)"
      />
    </SettingsRow>

    <!-- Once on: the state, a synchronization at once, the key. -->
    <div
      v-if="bookmarksOn || preferencesOn"
      class="flex items-center gap-3 py-2.5"
    >
      <UIcon
        :name="syncingShown ? 'i-lucide-refresh-cw' : needsAttention ? 'i-lucide-cloud-off' : 'i-lucide-cloud-check'"
        class="size-5 shrink-0"
        :class="[syncingShown && 'animate-spin motion-reduce:animate-none', needsAttention ? 'text-warning' : 'text-success']"
      />
      <p
        class="min-w-0 grow text-sm"
        role="status"
      >
        <template v-if="needsAttention">
          <span class="font-medium">{{ error }}</span>
          <template v-if="!errorNeedsAction">
            <span class="text-muted"> Vos modifications seront envoyées dès que possible.</span>
          </template>
          <button
            v-else
            type="button"
            class="ms-1 font-medium underline decoration-dotted underline-offset-3 hover:text-highlighted"
            aria-haspopup="dialog"
            @click="openDialog(errorSection ?? mainScope)"
          >
            Voir
          </button>
        </template>
        <template v-else-if="syncingShown">
          Synchronisation en cours…
        </template>
        <template v-else>
          {{ lastSync ? `Synchronisé ${lastSync}` : "Synchronisé" }}
        </template>
      </p>
      <UTooltip :text="manualSync === 'done' ? 'Synchronisé' : 'Synchroniser maintenant'">
        <UButton
          :icon="manualSync === 'done' ? 'i-lucide-check' : manualSync === 'failed' ? 'i-lucide-circle-alert' : 'i-lucide-refresh-cw'"
          aria-label="Synchroniser maintenant"
          :color="manualSync === 'done' ? 'success' : manualSync === 'failed' ? 'warning' : 'neutral'"
          variant="ghost"
          :loading="manualSync === 'running'"
          :disabled="status === 'syncing' && manualSync !== 'running'"
          @click="syncNow"
        />
      </UTooltip>
      <UButton
        label="Ma clé"
        icon="i-lucide-key-round"
        color="neutral"
        variant="outline"
        aria-haspopup="dialog"
        @click="openDialog(mainScope, 'key')"
      />
    </div>

    <!-- Loaded when first opened (with the QR code generator). -->
    <LazySyncDialog
      v-if="requested"
      v-model:open="isOpen"
      :scope="dialogScope"
      :link-secret="linkSecret"
      :start-view="startView"
    />
  </UCard>
</template>

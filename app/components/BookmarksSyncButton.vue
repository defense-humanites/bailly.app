<script setup lang="ts">
  import { fromBase64url } from "~/sync/base64url";

  /**
   * The synchronization of the bookmarks, on the bookmarks page: a button that
   * shows its state (off, up to date, running, waiting for the user) and
   * opens its window (`BookmarksSync`), also opened by a link (`#sync=…`).
   */

  const syncStore = useSyncStore();
  const { loaded, enabled, status, error } = storeToRefs(syncStore);

  const showButtonLabels = useButtonLabels();

  /**
   * Whether a synchronization has been running for a moment: the short ones
   * (most of them) don't change the button.
   */
  const syncingShown = ref(false);
  let syncingTimer: ReturnType<typeof setTimeout> | undefined;
  watch(status, (value) => {
    clearTimeout(syncingTimer);
    if (value === "syncing") {
      syncingTimer = setTimeout(() => {
        syncingShown.value = true;
      }, 400);
    } else {
      syncingShown.value = false;
    }
  });
  onBeforeUnmount(() => {
    clearTimeout(syncingTimer);
  });

  /**
   * Whether the synchronization failed (e.g. the limits would be exceeded:
   * the user has to make room).
   */
  const needsAttention = computed(() => enabled.value && status.value === "error" && Boolean(error.value));

  /**
   * The icon, after the state (a plain cloud until the settings are loaded,
   * once the application is hydrated: the button doesn't change meanwhile).
   */
  const icon = computed((): string => {
    if (!loaded.value) return "i-lucide-cloud";
    if (!enabled.value) return "i-lucide-cloud-upload";
    if (needsAttention.value) return "i-lucide-cloud-off";
    if (syncingShown.value) return "i-lucide-refresh-cw";
    return "i-lucide-cloud-check";
  });

  /**
   * The state, for the tooltip and the accessible name.
   */
  const stateText = computed((): string | null => {
    if (!loaded.value) return null;
    if (!enabled.value) return "désactivée";
    if (needsAttention.value) return "demande votre attention";
    return "activée";
  });

  const label = "Synchronisation";

  const tooltip = computed((): string => {
    if (!stateText.value) return label;
    return needsAttention.value ? `${label} : ${stateText.value}` : `${label} ${stateText.value}`;
  });

  const isSyncOpen = ref(false);
  /**
   * The key of a link (`/signets#sync=…`), to join the synchronization.
   */
  const linkSecret = ref<Uint8Array<ArrayBuffer> | null>(null);

  const route = useRoute();

  /**
   * Opens the synchronization window with the key of a link, when the page
   * loads or when its fragment changes (a link opened in the same tab).
   */
  const readLink = (hash: string): void => {
    const match = /^#sync=([\w-]{22})$/.exec(hash);
    if (!match) return;
    try {
      linkSecret.value = fromBase64url(match[1]!);
      isSyncOpen.value = true;
    } catch {
      // An invalid link: ignored.
    }
    // The key does not stay in the address (history, shared links).
    void navigateTo({ hash: "" }, { replace: true });
  };

  onMounted(() => {
    readLink(route.hash);
  });
  watch(() => route.hash, readLink);

  /**
   * Whether the synchronization window has been opened.
   */
  const syncRequested = ref(false);

  watch(isSyncOpen, (isOpen) => {
    if (isOpen) syncRequested.value = true;
  });

  const openSync = (): void => {
    // The key of a link only counts when the link is opened.
    linkSecret.value = null;
    isSyncOpen.value = true;
  };
</script>

<template>
  <div>
    <!--
      Icon only below `xl`, as the other actions of the page (the label stays
      for screen readers, and shows in the tooltip).
    -->
    <UTooltip
      :text="tooltip"
      :disabled="showButtonLabels && !needsAttention"
    >
      <UButton
        :label="label"
        size="2xl"
        variant="subtle"
        :aria-label="stateText ? `${label} (${stateText})` : label"
        :ui="{ base: 'max-xl:px-2.5', label: 'max-xl:sr-only' }"
        @click="openSync"
      >
        <template #leading>
          <!-- The leading slot gets no gap before the label: added from `xl`. -->
          <UChip
            :show="needsAttention"
            color="warning"
            size="md"
            inset
            class="xl:me-1.5"
          >
            <UIcon
              :name="icon"
              class="size-6 shrink-0"
              :class="{ 'animate-spin motion-reduce:animate-none': icon === 'i-lucide-refresh-cw' }"
            />
          </UChip>
        </template>
      </UButton>
    </UTooltip>

    <!-- Loaded when first opened (with the QR code generator). -->
    <LazyBookmarksSync
      v-if="syncRequested"
      v-model:open="isSyncOpen"
      :link-secret="linkSecret"
    />
  </div>
</template>

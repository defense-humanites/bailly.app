<script setup lang="ts">
  import { fromBase64url } from "~/sync/base64url";

  /**
   * The synchronization of a type of data, on its page (the bookmarks, the
   * preferences): a button that shows its state (off, up to date, running,
   * waiting for the user) and opens its window (`SyncDialog`), also opened by
   * a link (`#sync=…`).
   */

  const props = defineProps<{
    scope: "bookmarks" | "preferences";
  }>();

  const syncStore = useSyncStore();
  const { loaded, syncedBookmarks, syncedPreferences, status, error, errorSection } = storeToRefs(syncStore);

  /**
   * Until the settings are loaded (on the server, and a moment once
   * hydrated), whether the synchronization is on as a cookie tells (cf.
   * `utils/syncHint.ts`): the right button shows at once.
   */
  const hint = useCookie<unknown>(SYNC_HINT_COOKIE, { ...syncHintCookieOptions, readonly: true });
  const hinted = parseSyncHint(hint.value).includes(props.scope);

  /**
   * Whether this device synchronizes the type of data of the page.
   */
  const enabled = computed(() => {
    if (!loaded.value) return hinted;
    return props.scope === "bookmarks" ? syncedBookmarks.value : syncedPreferences.value.length > 0;
  });

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
  const needsAttention = computed(() => enabled.value && status.value === "error" && Boolean(error.value)
    && (errorSection.value === null || errorSection.value === props.scope));

  /**
   * The icon, after the state.
   */
  const icon = computed((): string => {
    if (!enabled.value) return "i-lucide-cloud-upload";
    if (needsAttention.value) return "i-lucide-cloud-off";
    if (syncingShown.value) return "i-lucide-refresh-cw";
    return "i-lucide-cloud-check";
  });

  /**
   * The state, for the tooltip and the accessible name.
   */
  const stateText = computed((): string | null => {
    if (!enabled.value) return "désactivée";
    if (needsAttention.value) return "demande votre attention";
    return "activée";
  });

  const label = "Synchronisation";

  /**
   * The look and the visible label, after the state: an invitation while the
   * synchronization is off (solid Aegean blue, « Synchroniser »), calm once
   * it is on (subtle, « Synchronisé »), gold when it needs attention
   * (« À vérifier »), once the settings are loaded (before, as the cookie
   * tells, cf. `hinted`). The accessible name stays « Synchronisation (…) ».
   */
  const look = computed((): { text: string; color: "secondary" | "warning"; variant: "solid" | "subtle" } => {
    if (!enabled.value) return { text: "Synchroniser", color: "secondary", variant: "solid" };
    if (needsAttention.value) return { text: "À vérifier", color: "warning", variant: "solid" };
    return { text: "Synchronisé", color: "secondary", variant: "subtle" };
  });

  /**
   * All the labels, laid in one cell: the button keeps the width of the
   * longest whatever the state (no shift when it changes; their lengths are
   * close).
   */
  const LABELS = ["Synchroniser", "À vérifier", "Synchronisé"];

  const tooltip = computed((): string => {
    if (!stateText.value) return label;
    return needsAttention.value ? `${label} : ${stateText.value}` : `${label} ${stateText.value}`;
  });

  const isSyncOpen = ref(false);
  /**
   * The key of a link (`/signets#sync=…`, `/préférences#sync=…`), to join the
   * synchronization.
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
        size="2xl"
        :color="look.color"
        :variant="look.variant"
        :aria-label="stateText ? `${label} (${stateText})` : label"
        :ui="{ base: 'max-xl:px-2.5' }"
        aria-haspopup="dialog"
        :aria-expanded="isSyncOpen"
        @click="openSync"
      >
        <template #leading>
          <UChip
            :show="needsAttention"
            color="warning"
            size="md"
            inset
          >
            <UIcon
              :name="icon"
              class="size-6 shrink-0"
              :class="{ 'animate-spin motion-reduce:animate-none': icon === 'i-lucide-refresh-cw' }"
            />
          </UChip>
        </template>
        <!-- From `xl` (cf. `LABELS`); the accessible name is the button's. -->
        <span
          aria-hidden="true"
          class="grid max-xl:hidden"
        >
          <span
            v-for="text in LABELS"
            :key="text"
            class="col-start-1 row-start-1 text-center"
            :class="{ invisible: text !== look.text }"
          >{{ text }}</span>
        </span>
      </UButton>
    </UTooltip>

    <!-- Loaded when first opened (with the QR code generator). -->
    <LazySyncDialog
      v-if="syncRequested"
      v-model:open="isSyncOpen"
      :scope="scope"
      :link-secret="linkSecret"
    />
  </div>
</template>

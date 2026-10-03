<script setup lang="ts">
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

  const { syncingShown } = useSyncActivity();

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
   * it is on (as the bar's other buttons, its icon only in blue,
   * « Synchronisé »), gold when it needs
   * attention (« À vérifier »), once the settings are loaded (before, as the cookie
   * tells, cf. `hinted`). The accessible name stays « Synchronisation (…) ».
   */
  const look = computed((): { text: string; color: "secondary" | "warning" | "neutral"; variant: "solid" | "ghost" } => {
    if (!enabled.value) return { text: "Synchroniser", color: "secondary", variant: "solid" };
    if (needsAttention.value) return { text: "À vérifier", color: "warning", variant: "solid" };
    return { text: "Synchronisé", color: "neutral", variant: "ghost" };
  });

  /**
   * All the labels, laid in one cell: the button keeps the width of the
   * longest whatever the state (no shift when it changes; their lengths are
   * close).
   */
  const LABELS = ["Synchroniser", "À vérifier", "Synchronisé"];

  /**
   * Pressed while its window is open, as the bar's other buttons
   * (`aria-expanded`): the shade of its hover (the solid buttons' own, cf.
   * `app.config.ts`).
   */
  const PRESSED = {
    secondary: { solid: "", ghost: "aria-expanded:bg-secondary/10" },
    warning: { solid: "", ghost: "aria-expanded:bg-warning/10" },
    neutral: { solid: "", ghost: "hover:bg-(--app-button-hover) active:bg-(--app-button-hover) aria-expanded:bg-(--app-button-hover)" },
  } as const;

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

  useSyncLink((secret) => {
    linkSecret.value = secret;
    isSyncOpen.value = true;
  });

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

  // For the page's invitations (e.g. the bookmarks' introduction).
  defineExpose({ open: openSync, enabled });
</script>

<template>
  <div>
    <!--
      An item of the bookmarks page's menu bar (cf. `signets.vue`), as
      « Fichiers » (cf. `BookmarksMenu`): square-cornered, as high as the bar.
      Icon only below `xl`, as the other actions of the page (the label stays
      for screen readers, and shows in the tooltip).
    -->
    <UTooltip
      :text="tooltip"
      :disabled="showButtonLabels && !needsAttention"
    >
      <UButton
        size="xl"
        :color="look.color"
        :variant="look.variant"
        class="h-full rounded-none"
        :class="PRESSED[look.color][look.variant]"
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
              :class="{ 'animate-spin motion-reduce:animate-none': icon === 'i-lucide-refresh-cw', 'text-secondary': look.color === 'neutral' }"
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

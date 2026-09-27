<script setup lang="ts">
  import type { DropdownMenuItem } from "@nuxt/ui";
  import type { SkippedRecords } from "~/idb";
  import { bookmarksFileName } from "~/idb/transfer";
  import { fromBase64url } from "~/sync/base64url";

  /**
   * The largest file accepted for an import (an export of the maximum number
   * of bookmarks weighs about 3 MB): it is read at once, on the main thread.
   */
  const MAX_IMPORT_SIZE = 5 * 1024 * 1024;

  const bookmarksStore = useBookmarksStore();
  const toast = useToast();

  const fileInput = useTemplateRef<HTMLInputElement>("file-input");

  /**
   * Downloads the bookmarks as a file.
   */
  const exportBookmarks = async (): Promise<void> => {
    const file = await bookmarksStore.exportBookmarks();
    const name = bookmarksFileName();
    const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }));

    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);

    toast.add({
      title: "Signets exportés",
      description: `Fichier « ${name} ».`,
      icon: "i-lucide-circle-check",
      color: "success",
    });
  };

  /**
   * The numbers of bookmarks, to tell what an import added.
   */
  const counts = () => ({
    tags: bookmarksStore.tags.length,
    entries: bookmarksStore.taggedEntries.length + bookmarksStore.starredEntries.length,
  });

  const plural = (n: number, word: string): string => `${n} ${word}${n > 1 ? "s" : ""}`;

  /**
   * An import that would exceed the limits, while the user confirms it: the
   * content of the file, and what would be left out.
   */
  const pendingImport = shallowRef<{ text: string; skipped: SkippedRecords } | null>(null);

  const isImportConfirmOpen = computed({
    get: () => pendingImport.value !== null,
    set: (isOpen: boolean) => {
      if (!isOpen) pendingImport.value = null;
    },
  });

  /**
   * What an import would leave out, e.g. « 2 étiquettes et 30 entrées ».
   */
  const skippedText = computed(() => {
    const skipped = pendingImport.value?.skipped;
    if (!skipped) return "";
    return [skipped.tags ? plural(skipped.tags, "étiquette") : "", skipped.entries ? plural(skipped.entries, "entrée") : ""]
      .filter(Boolean)
      .join(" et ");
  });

  const skippedPlural = computed(() => {
    const skipped = pendingImport.value?.skipped;
    return Boolean(skipped && skipped.tags + skipped.entries > 1);
  });

  const { maxTags, tagMaxItems } = useRuntimeConfig().public;

  /**
   * Imports the chosen file: its bookmarks are merged into the stored ones.
   * If some would exceed the limits, the user is asked first.
   */
  const importBookmarks = async (event: Event): Promise<void> => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    if (file.size > MAX_IMPORT_SIZE) {
      toast.add({ title: "Ce fichier est trop volumineux.", icon: "i-lucide-circle-alert", color: "error" });
      return;
    }

    const text = await file.text();
    const preview = await bookmarksStore.previewImport(text);
    // Errors are reported by the store.
    if (preview.state === "error") return;
    if (preview.data.tags || preview.data.entries) {
      pendingImport.value = { text, skipped: preview.data };
      return;
    }
    await runImport(text);
  };

  const confirmImport = (): void => {
    if (pendingImport.value) void runImport(pendingImport.value.text);
  };

  /**
   * Imports the content of a file (what exceeds the limits is left out).
   */
  const runImport = async (text: string): Promise<void> => {
    pendingImport.value = null;
    const before = counts();
    const result = await bookmarksStore.importBookmarks(text);
    // Errors are reported by the store.
    if (result.state === "error") return;

    const after = counts();
    const added = [
      after.tags > before.tags ? plural(after.tags - before.tags, "étiquette") : "",
      after.entries > before.entries ? plural(after.entries - before.entries, "entrée") : "",
    ].filter(Boolean);

    toast.add({
      title: "Signets importés",
      description: added.length ? `Ajout : ${added.join(" et ")}.` : "Tous les signets de ce fichier étaient déjà là.",
      icon: "i-lucide-circle-check",
      color: "success",
    });
  };

  const syncStore = useSyncStore();
  const { enabled: syncEnabled, status: syncStatus } = storeToRefs(syncStore);

  /**
   * Whether the synchronization failed (e.g. the limits would be exceeded:
   * the user has to make room).
   */
  const syncNeedsAttention = computed(() => syncEnabled.value && syncStatus.value === "error");

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

  const items = computed((): DropdownMenuItem[] => [
    {
      label: "Exporter les signets",
      icon: "i-lucide-download",
      onSelect: () => void exportBookmarks(),
    },
    {
      label: "Importer des signets",
      icon: "i-lucide-upload",
      onSelect: () => {
        fileInput.value?.click();
      },
    },
    { type: "separator" },
    {
      label: syncEnabled.value ? "Synchronisation activée" : "Synchroniser…",
      icon: syncEnabled.value && syncStatus.value === "error" ? "i-lucide-cloud-off" : syncEnabled.value ? "i-lucide-cloud-check" : "i-lucide-refresh-cw",
      onSelect: () => {
        // The key of a link only counts when the link is opened.
        linkSecret.value = null;
        isSyncOpen.value = true;
      },
    },
  ]);
</script>

<template>
  <div>
    <UDropdownMenu
      :items="items"
      :content="{ align: 'end' }"
    >
      <UTooltip :text="syncNeedsAttention ? 'Sauvegarde des signets : la synchronisation demande votre attention' : 'Sauvegarde des signets'">
        <UButton
          size="2xl"
          variant="subtle"
          :aria-label="syncNeedsAttention ? 'Sauvegarde des signets (la synchronisation demande votre attention)' : 'Sauvegarde des signets'"
          class="px-2.5"
        >
          <UChip
            :show="syncNeedsAttention"
            color="warning"
            size="md"
            inset
          >
            <UIcon
              name="i-lucide-ellipsis"
              class="size-6"
            />
          </UChip>
        </UButton>
      </UTooltip>
    </UDropdownMenu>

    <!-- Loaded when first opened (with the QR code generator). -->
    <LazyBookmarksSync
      v-if="syncRequested"
      v-model:open="isSyncOpen"
      :link-secret="linkSecret"
    />

    <UModal
      v-model:open="isImportConfirmOpen"
      title="Limites des signets"
      :ui="{ footer: 'justify-end flex-wrap' }"
    >
      <template #body>
        <p class="text-sm">
          {{ skippedText }} de ce fichier ne {{ skippedPlural ? "tiennent" : "tient" }} pas dans les limites
          (au plus {{ maxTags }} étiquettes, {{ tagMaxItems }} entrées par étiquette et {{ tagMaxItems }} favoris) :
          {{ skippedPlural ? "elles ne seront pas importées" : "elle ne sera pas importée" }}. Vos signets actuels restent tous.
        </p>
      </template>
      <template #footer>
        <UButton
          label="Annuler"
          color="neutral"
          variant="outline"
          @click="isImportConfirmOpen = false"
        />
        <UButton
          label="Importer les autres"
          @click="confirmImport"
        />
      </template>
    </UModal>

    <!-- Opened by "Importer des signets". -->
    <input
      ref="file-input"
      type="file"
      accept=".json,application/json"
      class="sr-only"
      tabindex="-1"
      aria-hidden="true"
      @change="importBookmarks"
    >
  </div>
</template>

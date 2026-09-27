<script setup lang="ts">
  import type { DropdownMenuItem } from "@nuxt/ui";
  import { bookmarksFileName } from "~/idb/transfer";
  import { fromBase64url } from "~/sync/base64url";

  /**
   * The largest file accepted for an import (an export of the maximum number
   * of bookmarks weighs about 3 MB).
   */
  const MAX_IMPORT_SIZE = 10 * 1024 * 1024;

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
   * Imports the chosen file: its bookmarks are merged into the stored ones.
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

    const before = counts();
    const result = await bookmarksStore.importBookmarks(await file.text());
    // Errors are reported by the store.
    if (result.state === "error") return;

    const after = counts();
    const added = [
      after.tags > before.tags ? plural(after.tags - before.tags, "étiquette") : "",
      after.entries > before.entries ? plural(after.entries - before.entries, "entrée") : "",
    ].filter(Boolean);

    toast.add({
      title: "Signets importés",
      description: added.length ? `Ajout : ${added.join(" et ")}.` : "Vos signets étaient déjà à jour.",
      icon: "i-lucide-circle-check",
      color: "success",
    });
  };

  const syncStore = useSyncStore();
  const { enabled: syncEnabled, status: syncStatus } = storeToRefs(syncStore);

  const isSyncOpen = ref(false);
  /**
   * The key of a link (`/signets#sync=…`), to join the synchronization.
   */
  const linkSecret = ref<Uint8Array<ArrayBuffer> | null>(null);

  const route = useRoute();
  onMounted(() => {
    const match = /^#sync=([\w-]{22})$/.exec(route.hash);
    if (!match) return;
    try {
      linkSecret.value = fromBase64url(match[1]!);
      isSyncOpen.value = true;
    } catch {
      // An invalid link: ignored.
    }
    // The key does not stay in the address (history, shared links).
    void navigateTo({ hash: "" }, { replace: true });
  });

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
      <UTooltip text="Sauvegarde des signets">
        <UButton
          icon="i-lucide-ellipsis"
          size="2xl"
          variant="subtle"
          aria-label="Sauvegarde des signets"
          class="px-2.5"
        />
      </UTooltip>
    </UDropdownMenu>

    <!-- Loaded when first opened (with the QR code generator). -->
    <LazyBookmarksSync
      v-if="syncRequested"
      v-model:open="isSyncOpen"
      :link-secret="linkSecret"
    />

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

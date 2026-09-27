<script setup lang="ts">
  import type { DropdownMenuItem } from "@nuxt/ui";
  import { bookmarksFileName } from "~/idb/transfer";

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

  const items: DropdownMenuItem[] = [
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
  ];
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

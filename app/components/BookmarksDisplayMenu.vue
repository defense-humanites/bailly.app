<script setup lang="ts">
  import type { DropdownMenuItem } from "@nuxt/ui";
  import { TAG_SORT_LABELS, TAG_SORTS } from "~/utils/tagSort";

  const showButtonLabels = useButtonLabels();
  const display = useBookmarksDisplay();
  const sort = useTagSort();

  /**
   * The display of the bookmarks: the entries (excerpts or headwords alone)
   * and the sorting of the tags (the pinned ones staying first), the current
   * choices checked (also on the preferences page, its « Signets » card).
   */
  const items = computed((): DropdownMenuItem[][] => [
    [
      { type: "label", label: "Entrées" },
      ...BOOKMARKS_DISPLAYS.map(value => ({
        type: "checkbox" as const,
        label: BOOKMARKS_DISPLAY_LABELS[value],
        description: value === "excerpts" ? "Le début de leur définition." : "Sur deux colonnes, l'extrait au survol.",
        checked: display.value === value,
        onUpdateChecked: () => {
          display.value = value;
        },
      })),
    ],
    [
      { type: "label", label: "Tri des étiquettes" },
      ...TAG_SORTS.map(value => ({
        type: "checkbox" as const,
        label: TAG_SORT_LABELS[value],
        checked: sort.value === value,
        onUpdateChecked: () => {
          sort.value = value;
        },
      })),
    ],
  ]);
</script>

<template>
  <div>
    <UDropdownMenu
      :items="items"
      :content="{ align: 'end' }"
    >
      <!--
        An item of the bookmarks page's menu bar (cf. `signets.vue`), as
        « Fichiers » (cf. `BookmarksMenu`). Its label doesn't tell the current
        choices, read from the device once hydrated: the server's markup stays
        the client's.
      -->
      <UTooltip
        text="Affichage"
        :disabled="showButtonLabels"
      >
        <UButton
          label="Affichage"
          icon="i-lucide-layout-list"
          size="xl"
          color="neutral"
          variant="ghost"
          class="h-full rounded-none hover:bg-(--app-button-hover) active:bg-(--app-button-hover) aria-expanded:bg-(--app-button-hover)"
          :ui="{ base: 'max-xl:px-2.5', label: 'max-xl:sr-only' }"
        />
      </UTooltip>
    </UDropdownMenu>
  </div>
</template>

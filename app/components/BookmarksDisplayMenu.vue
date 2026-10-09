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

  /**
   * The menu, opened from elsewhere too (e.g. the bookmarks' guide):
   * brought into view (`revealThen`), its button focused first (the focus
   * comes back to it once it closes) and pointed out (`pointOut`, in
   * `--card-highlight`).
   */
  const isMenuOpen = ref(false);
  const root = useTemplateRef<HTMLElement>("root");
  const open = (): void => {
    const element = root.value;
    if (!element) return;
    // Brought into view first (not to open the menu off the screen).
    revealThen(element, () => {
      element.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
      pointOut(element);
      isMenuOpen.value = true;
    });
  };

  defineExpose({ open });
</script>

<template>
  <div ref="root">
    <UDropdownMenu
      v-model:open="isMenuOpen"
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
          class="h-full rounded-none hover:bg-(--app-button-hover) active:bg-(--app-button-active) aria-expanded:bg-(--app-button-active)"
          :ui="{ base: 'max-xl:px-2.5', label: 'max-xl:sr-only' }"
        />
      </UTooltip>
    </UDropdownMenu>
  </div>
</template>

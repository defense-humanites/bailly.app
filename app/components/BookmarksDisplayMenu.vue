<script setup lang="ts">
  import type { DropdownMenuItem } from "@nuxt/ui";

  const showButtonLabels = useButtonLabels();
  const display = useBookmarksDisplay();

  /**
   * The ways to show the entries, the current one checked.
   */
  const items = computed((): DropdownMenuItem[][] => [
    [{ type: "label", label: "Afficher les entrées" }],
    BOOKMARKS_DISPLAYS.map(value => ({
      type: "checkbox" as const,
      label: BOOKMARKS_DISPLAY_LABELS[value],
      description: value === "excerpts" ? "Le début de leur définition." : "Sur deux colonnes, l'extrait au survol.",
      checked: display.value === value,
      onUpdateChecked: () => {
        display.value = value;
      },
    })),
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
        « Tri » (cf. `TagSortMenu`); its label doesn't tell the current
        display (read from the device once hydrated).
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
          class="h-full rounded-none aria-expanded:bg-elevated"
          :ui="{ base: 'max-xl:px-2.5', label: 'max-xl:sr-only' }"
        />
      </UTooltip>
    </UDropdownMenu>
  </div>
</template>

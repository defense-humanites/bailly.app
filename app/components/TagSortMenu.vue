<script setup lang="ts">
  import type { DropdownMenuItem } from "@nuxt/ui";
  import { TAG_SORT_LABELS, TAG_SORTS } from "~/utils/tagSort";

  const showButtonLabels = useButtonLabels();
  const sort = useTagSort();

  /**
   * The ways to sort the tags, the current one checked; the pinned tags stay
   * first whatever the choice.
   */
  const items = computed((): DropdownMenuItem[][] => [
    [{ type: "label", label: "Trier les étiquettes" }],
    TAG_SORTS.map(value => ({
      type: "checkbox" as const,
      label: TAG_SORT_LABELS[value],
      checked: sort.value === value,
      onUpdateChecked: () => {
        sort.value = value;
      },
    })),
    [{ type: "label", label: "Les étiquettes épinglées restent en tête.", class: "font-normal text-muted" }],
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
        « Fichier » (cf. `BookmarksMenu`). Its label doesn't tell the current
        sort, read from the device once hydrated: the server's markup stays
        the client's.
      -->
      <UTooltip
        text="Trier"
        :disabled="showButtonLabels"
      >
        <UButton
          label="Trier"
          icon="i-lucide-arrow-up-down"
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

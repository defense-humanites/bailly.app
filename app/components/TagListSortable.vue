<script setup lang="ts">
  import { moveArrayElement, useSortable } from "@vueuse/integrations/useSortable";
  import type { SortableEvent } from "sortablejs";
  import { Color, type ColorKey } from "~/enums";
  import type { IdbTagWithKey } from "~/idb";
  import { TailwindColorClasses } from "~/TailwindColorClasses";

  const emit = defineEmits<{
    (e: "reorderTags", orderedKeys: number[]): void;
  }>();

  const props = defineProps<{
    /**
     * Tags with their primary keys.
     */
    tags: IdbTagWithKey[];
  }>();

  /**
   * Sortable tags.
   * @remarks A copy: sorting must not mutate the array passed as a prop
   * (i.e. the store state).
   */
  const sortableTags = ref<IdbTagWithKey[]>([...props.tags]);

  /**
   * Updates `sortableTags` when `props.tags` change.
   */
  watch(() => props.tags, (tags) => {
    sortableTags.value = [...tags];
  }, { deep: true });

  /**
   * A reference to the tag list from the reorder modal.
   */
  const tagList = useTemplateRef("tag-list");
  useSortable(tagList, sortableTags, {
    animation: 250,
    /**
     * Sorts the array and emits the new order when the change is completed.
     */
    onUpdate: (e: SortableEvent) => {
      if (e.oldIndex === undefined || e.newIndex === undefined) return;

      moveArrayElement(sortableTags, e.oldIndex, e.newIndex, e);
      void nextTick(() => {
        emit("reorderTags", sortableTags.value.map(tag => tag.key));
      });
    },
  });

  /** Return Tailwind color classes. */
  const tagColor = (colorKey: ColorKey): TailwindColorClasses => {
    return new TailwindColorClasses(Color[colorKey]);
  };
</script>

<template>
  <ol
    ref="tag-list"
    class="space-y-3 select-none"
  >
    <li
      v-for="tag in sortableTags"
      :key="tag.key"
      class="px-3 py-1.5 flex items-center hover:bg-neutral-100 rounded-lg text-lg font-semibold cursor-default"
    >
      <UIcon
        name="i-heroicons-bars-3"
        class="mr-3 size-5"
      />
      <UIcon
        name="i-heroicons-tag-solid"
        class="mr-3 size-5"
        :class="tagColor(tag.color).text()"
      />
      {{ tag.name }}
    </li>
  </ol>
</template>

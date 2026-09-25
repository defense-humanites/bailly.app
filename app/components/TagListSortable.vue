<script setup lang="ts">
  import { moveArrayElement, useSortable } from "@vueuse/integrations/useSortable";
  import type { SortableEvent } from "sortablejs";
  import type { IdbTagWithKey } from "~/idb";

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

  /**
   * The last move, announced to screen readers.
   */
  const announcement = ref<string>("");

  /**
   * Moves a tag up or down (the keyboard equivalent of dragging it).
   * @param index The tag index.
   * @param offset `-1` to move it up, `1` to move it down.
   */
  const moveTag = (index: number, offset: -1 | 1): void => {
    const target = index + offset;
    const tags = [...sortableTags.value];
    const [tag] = tags.splice(index, 1);
    if (!tag || target < 0 || target > tags.length) return;

    tags.splice(target, 0, tag);
    sortableTags.value = tags;
    announcement.value = `« ${tag.name} » est en position ${target + 1} sur ${tags.length}.`;
    emit("reorderTags", tags.map(t => t.key));
  };
</script>

<template>
  <ol
    ref="tag-list"
    class="space-y-3 select-none"
  >
    <li
      v-for="(tag, index) in sortableTags"
      :key="tag.key"
      class="px-3 py-1.5 flex items-center hover:bg-neutral-100 rounded-lg text-lg font-semibold cursor-default"
    >
      <UIcon
        name="i-lucide-grip-vertical"
        class="mr-3 size-5"
      />
      <UIcon
        name="i-bailly-tag-filled"
        class="mr-3 size-5 text-tag-600"
        :data-tag-color="tag.color"
      />
      <span class="grow">{{ tag.name }}</span>
      <!-- Keyboard (and precise) equivalent of dragging. -->
      <span class="flex gap-1">
        <UButton
          icon="i-lucide-chevron-up"
          size="sm"
          color="neutral"
          variant="ghost"
          :aria-label="`Monter « ${tag.name} »`"
          :disabled="index === 0"
          @click="moveTag(index, -1)"
        />
        <UButton
          icon="i-lucide-chevron-down"
          size="sm"
          color="neutral"
          variant="ghost"
          :aria-label="`Descendre « ${tag.name} »`"
          :disabled="index === sortableTags.length - 1"
          @click="moveTag(index, 1)"
        />
      </span>
    </li>
  </ol>
  <p
    class="sr-only"
    aria-live="polite"
  >
    {{ announcement }}
  </p>
</template>

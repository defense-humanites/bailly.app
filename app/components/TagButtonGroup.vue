<script setup lang="ts">
  import { Color } from "~/enums";
  import type { IdbEntry } from "~/idb";
  import { TailwindColorClasses } from "~/TailwindColorClasses";

  const bookmarksStore = useBookmarksStore();
  const { currentTag, starredEntries, taggedEntries } = storeToRefs(bookmarksStore);

  const props = defineProps<{
    /**
     * The entry on which to perform actions.
     */
    entry: IdbEntry;
  }>();

  /**
   * A boolean representing whether the current entry has been starred.
   * @remarks Derived from the store, so that it stays correct once the store
   * is initialized and when the entry is (un)starred elsewhere.
   */
  const starred = computed((): boolean =>
    starredEntries.value.some(el => el.uri === props.entry.uri),
  );
  /**
   * A boolean representing whether the current entry belongs to the current tag.
   */
  const taggedAsCurrent = computed((): boolean =>
    taggedEntries.value.some(
      el => el.uri === props.entry.uri && el.tagKey === currentTag.value?.key,
    ),
  );

  const handleTagChange = async (): Promise<void> => {
    const currentTagKey = currentTag.value?.key;
    if (currentTagKey === undefined) return;

    if (taggedAsCurrent.value) {
      await bookmarksStore.untagEntry(props.entry.uri, currentTagKey);
    } else {
      await bookmarksStore.tagEntry(props.entry, currentTagKey);
    }
  };

  const toggleStar = async (): Promise<void> => {
    if (starred.value) {
      await bookmarksStore.unstarEntry(props.entry.uri);
    } else {
      await bookmarksStore.starEntry(props.entry);
    }
  };

  const currentTagColor = computed(() =>
    currentTag.value
      ? new TailwindColorClasses(Color[currentTag.value.color])
      : undefined,
  );
</script>

<template>
  <UButtonGroup
    orientation="horizontal"
    class="border border-neutral-200 rounded-lg [&>button]:rounded-lg shadow-xs [&>button]:shadow-none"
  >
    <!-- Manage tags -->
    <UButton
      icon="i-heroicons-ellipsis-horizontal-circle"
      color="neutral"
      variant="ghost"
    />

    <!-- Toggle current tag -->
    <UButton
      v-if="currentTag"
      :label="currentTag.name"
      :icon="taggedAsCurrent ? 'i-heroicons-tag-solid' : 'i-heroicons-tag'"
      :class="taggedAsCurrent
        ? currentTagColor?.text()
        : currentTagColor?.classes(['hover:text'])
      "
      :ui="{
        label:
          'max-w-8 overflow-hidden whitespace-nowrap mask-r-from-50% mask-r-to-100% text-clip text-xs tracking-tighter',
      }"
      color="neutral"
      variant="ghost"
      @click="handleTagChange"
    />

    <!-- Toggle star -->
    <UButton
      :icon="starred ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
      color="neutral"
      variant="ghost"
      :class="starred ? 'text-primary-400' : 'hover:text-primary-400'"
      :ui="{ base: 'border-l border-neutral-200' }"
      @click="toggleStar"
    />
  </UButtonGroup>
</template>

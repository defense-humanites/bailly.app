<script setup lang="ts">
  import { Color } from "~/enums";
  import { IdbTags, type IdbEntry } from "~/idb";
  import { TailwindColorClasses } from "~/TailwindColorClasses";

  const bookmarksStore = useBookmarksStore();
  const { currentTag, starredEntries } = storeToRefs(bookmarksStore);

  const props = defineProps<{
    /**
     * The entry on which to perform actions.
     */
    entry: IdbEntry;
  }>();

  /**
   * A boolean representing whether the current entry has been starred.
   */
  const starred = ref<boolean>(starredEntries.value.some(el => el.uri === props.entry.uri));
  /**
   * The selected tag keys for the current entry.
   */
  const selectedTagKeys = ref<number[] | null>(null);
  /**
   * A boolean representing whether the current entry belongs to the current tag.
   */
  const taggedAsCurrent = computed((): boolean =>
    Boolean(selectedTagKeys.value?.includes(currentTag.value?.key ?? -1))
  );

  onMounted(async () => {
    selectedTagKeys.value = await IdbTags.getEntryTagKeys(props.entry.uri);
  });

  const handleTagChange = async (): Promise<void> => {
    const currentTagKey: number | undefined = currentTag.value?.key;

    if (!currentTagKey) return;

    taggedAsCurrent.value
      ? await bookmarksStore.untagEntry(props.entry.uri, currentTagKey)
      : await bookmarksStore.tagEntry(props.entry, currentTagKey);

    selectedTagKeys.value = await IdbTags.getEntryTagKeys(props.entry.uri);
  };

  const toggleStar = async (): Promise<void> => {
    const response = starred.value
      ? await bookmarksStore.unstarEntry(props.entry.uri)
      : await bookmarksStore.starEntry(props.entry);

    if (response.state === "success") starred.value = !starred.value;
  };

  const currentTagColor = computed(() =>
    currentTag.value
      ? new TailwindColorClasses(Color[currentTag.value.color])
      : undefined
  );
</script>

<template>
  <UButtonGroup orientation="horizontal"
    class="border border-neutral-200 rounded-lg [&>button]:rounded-lg shadow-xs [&>button]:shadow-none">
    <!-- Manage tags -->
    <UButton icon="i-heroicons-ellipsis-horizontal-circle" color="neutral" variant="ghost" />

    <!-- Toggle current tag -->
    <UButton v-if="currentTag" @click="handleTagChange" :label="currentTag.name"
      :icon="taggedAsCurrent ? 'i-heroicons-tag-solid' : 'i-heroicons-tag'" :class="taggedAsCurrent
        ? currentTagColor?.text()
        : currentTagColor?.classes(['hover:text'])
        " :ui="{
          label:
            'max-w-8 overflow-hidden whitespace-nowrap mask-r-from-50% mask-r-to-100% text-clip text-xs tracking-tighter',
        }" color="neutral" variant="ghost" />

    <!-- Toggle star -->
    <UButton @click="toggleStar" :icon="starred ? 'i-heroicons-star-solid' : 'i-heroicons-star'" color="neutral"
      variant="ghost" :class="starred ? 'text-primary-400' : 'hover:text-primary-400'"
      :ui="{ base: 'border-l border-neutral-200' }" />
  </UButtonGroup>
</template>
